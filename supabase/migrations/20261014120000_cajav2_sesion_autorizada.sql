-- EXPERIMENTAL (rama feat/ventas-cajas-nuevo-flujo) · Cajas fisicas y sesiones
-- autorizadas por el gerente.
--
-- Todo lo nuevo lleva el prefijo cajav2 (tablas cajav2_*, funciones fn_cajav2_*,
-- triggers trg_cajav2_*, errcodes CJV*) y no modifica ningun objeto existente.
-- Se borra entero con supabase/rollback/cajav2_drop.sql.
--
-- Flujo:
--   empleado elige una caja libre + monto inicial -> sesion 'Pendiente'
--   gerente aprueba -> se crea una fila normal en public.caja (estado 'Abierta')
--     y la sesion pasa a 'Abierta'. Ventas, movimientos y arqueos siguen usando
--     las fn_caja_* / fn_venta_registrar de siempre contra esa caja.
--   empleado arquea y pide el cierre -> 'Cierre solicitado' (no admite movimientos)
--   gerente cierra (fn_caja_cerrar de siempre) -> 'Cerrada'; o rechaza -> 'Abierta'
--   gerente puede rechazar la apertura -> 'Rechazada'
--
-- Errcodes:
--   CJV01 solo el gerente           CJV05 la sesion no admite movimientos
--   CJV02 caja fisica invalida      CJV06 solo el empleado de la caja opera
--   CJV03 caja ocupada / empleado con sesion activa
--   CJV04 la sesion no esta en el estado que pide la operacion

-- ---------------------------------------------------------------------------
-- Helper de rol
-- ---------------------------------------------------------------------------

create function public.fn_cajav2_es_gerente()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.usuario
    where id_usuario = auth.uid() and rol_usuario = 'Gerente'
  );
$$;

revoke execute on function public.fn_cajav2_es_gerente() from public, anon;
grant execute on function public.fn_cajav2_es_gerente() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.cajav2_registradora (
  id_registradora uuid primary key default gen_random_uuid(),
  numero          integer not null check (numero > 0),
  nombre          text,
  id_deposito     uuid not null references public.deposito (id_deposito),
  activa          boolean not null default true,
  creado          timestamptz not null default now(),
  creado_por      uuid default auth.uid(),
  editado         timestamptz not null default now(),
  constraint cajav2_registradora_numero_uk unique (numero)
);

create table public.cajav2_sesion (
  id_sesion              uuid primary key default gen_random_uuid(),
  id_registradora        uuid not null references public.cajav2_registradora (id_registradora),
  id_empleado            uuid not null default auth.uid(),
  estado                 text not null default 'Pendiente'
                         check (estado in ('Pendiente', 'Abierta', 'Cierre solicitado', 'Cerrada', 'Rechazada')),
  monto_inicial          numeric(14,2) not null check (monto_inicial >= 0),
  observaciones_apertura text,
  fecha_solicitud        timestamptz not null default now(),
  autorizada_por         uuid,
  fecha_autorizacion     timestamptz,
  id_caja                uuid references public.caja (id_caja),
  fecha_solicitud_cierre timestamptz,
  observaciones_cierre   text,
  motivo_rechazo         text,
  fecha_fin              timestamptz,
  editado                timestamptz not null default now(),
  constraint cajav2_sesion_caja_uk unique (id_caja),
  -- Solo las sesiones aprobadas tienen caja.
  constraint cajav2_sesion_caja_ck check ((estado in ('Pendiente', 'Rechazada')) = (id_caja is null))
);

-- Una sola sesion viva por caja fisica y por empleado.
create unique index cajav2_sesion_registradora_viva_uk on public.cajav2_sesion (id_registradora)
  where estado in ('Pendiente', 'Abierta', 'Cierre solicitado');
create unique index cajav2_sesion_empleado_viva_uk on public.cajav2_sesion (id_empleado)
  where estado in ('Pendiente', 'Abierta', 'Cierre solicitado');

alter table public.cajav2_registradora enable row level security;
alter table public.cajav2_sesion enable row level security;

create policy cajav2_registradora_select on public.cajav2_registradora
  for select to authenticated using (true);
create policy cajav2_registradora_insert_gerente on public.cajav2_registradora
  for insert to authenticated with check (public.fn_cajav2_es_gerente());
create policy cajav2_registradora_update_gerente on public.cajav2_registradora
  for update to authenticated using (public.fn_cajav2_es_gerente()) with check (public.fn_cajav2_es_gerente());

-- Las reglas de quien puede hacer que viven en las fn_cajav2_*.
create policy cajav2_sesion_select on public.cajav2_sesion
  for select to authenticated using (true);
create policy cajav2_sesion_insert on public.cajav2_sesion
  for insert to authenticated with check (true);
create policy cajav2_sesion_update on public.cajav2_sesion
  for update to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Vista de lectura: sesion + caja fisica + nombres
-- ---------------------------------------------------------------------------

create view public.cajav2_vw_sesion
with (security_invoker = true)
as
select
  s.id_sesion,
  s.estado,
  s.id_registradora,
  r.numero,
  r.nombre as nombre_caja,
  r.id_deposito,
  d.nombre_deposito,
  s.id_empleado,
  coalesce(ue.nombre_completo, 'Usuario no disponible') as empleado_nombre,
  s.monto_inicial,
  s.observaciones_apertura,
  s.fecha_solicitud,
  s.autorizada_por,
  ua.nombre_completo as autorizada_por_nombre,
  s.fecha_autorizacion,
  s.id_caja,
  c.fecha_apertura,
  s.fecha_solicitud_cierre,
  s.observaciones_cierre,
  s.motivo_rechazo,
  s.fecha_fin
from public.cajav2_sesion s
join public.cajav2_registradora r on r.id_registradora = s.id_registradora
join public.deposito d on d.id_deposito = r.id_deposito
left join public.caja c on c.id_caja = s.id_caja
left join public.vw_usuario_resumen ue on ue.id_usuario = s.id_empleado
left join public.vw_usuario_resumen ua on ua.id_usuario = s.autorizada_por;

-- ---------------------------------------------------------------------------
-- Triggers sobre tablas existentes (identificables, se borran con el rollback)
-- ---------------------------------------------------------------------------

-- Movimientos y arqueos de una caja abierta por cajav2: solo con la sesion
-- 'Abierta' y solo el empleado asignado (o un gerente). Las cajas viejas, sin
-- sesion cajav2, siguen igual.
create function public.fn_cajav2_validar_operacion()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_sesion public.cajav2_sesion;
  v_gerente boolean;
begin
  select * into v_sesion from public.cajav2_sesion where id_caja = new.id_caja;
  if v_sesion.id_sesion is null then
    return new;
  end if;

  v_gerente := public.fn_cajav2_es_gerente();

  if v_sesion.estado <> 'Abierta'
     and not (v_gerente and tg_table_name = 'arqueo_caja' and v_sesion.estado = 'Cierre solicitado') then
    raise exception 'La caja tiene el cierre pedido y no admite movimientos' using errcode = 'CJV05';
  end if;
  if coalesce(new.creado_por, auth.uid()) is distinct from v_sesion.id_empleado and not v_gerente then
    raise exception 'Solo el empleado asignado a la caja puede operarla' using errcode = 'CJV06';
  end if;
  return new;
end;
$$;

create trigger trg_cajav2_validar_movimiento
before insert on public.movimiento_caja
for each row execute function public.fn_cajav2_validar_operacion();

create trigger trg_cajav2_validar_arqueo
before insert on public.arqueo_caja
for each row execute function public.fn_cajav2_validar_operacion();

-- Cuando la caja se cierra (por la via que sea), la sesion termina.
create function public.fn_cajav2_sincronizar_cierre()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  update public.cajav2_sesion
  set estado = 'Cerrada', fecha_fin = coalesce(new.fecha_cierre, now()), editado = now()
  where id_caja = new.id_caja and estado <> 'Cerrada';
  return new;
end;
$$;

create trigger trg_cajav2_sincronizar_cierre
after update of estado on public.caja
for each row when (new.estado = 'Cerrada' and old.estado is distinct from 'Cerrada')
execute function public.fn_cajav2_sincronizar_cierre();

-- ---------------------------------------------------------------------------
-- Cajas fisicas
-- ---------------------------------------------------------------------------

create function public.fn_cajav2_registradora_guardar(
  p_id_registradora uuid,
  p_numero integer,
  p_nombre text,
  p_id_deposito uuid,
  p_activa boolean default true
)
returns public.cajav2_registradora
language plpgsql
set search_path to 'public'
as $$
declare
  v_reg public.cajav2_registradora;
begin
  if not public.fn_cajav2_es_gerente() then
    raise exception 'Solo el gerente puede administrar las cajas' using errcode = 'CJV01';
  end if;
  if p_numero is null or p_numero <= 0 then
    raise exception 'El numero de caja tiene que ser mayor a cero' using errcode = 'CJV02';
  end if;
  if p_id_deposito is null
     or not exists (select 1 from public.deposito where id_deposito = p_id_deposito and activo) then
    raise exception 'Elegi un deposito activo: la caja vende el stock de esa sucursal' using errcode = 'CJV02';
  end if;

  if p_id_registradora is null then
    insert into public.cajav2_registradora (numero, nombre, id_deposito, activa)
    values (p_numero, nullif(btrim(p_nombre), ''), p_id_deposito, coalesce(p_activa, true))
    returning * into v_reg;
    return v_reg;
  end if;

  if exists (
    select 1 from public.cajav2_sesion
    where id_registradora = p_id_registradora
      and estado in ('Pendiente', 'Abierta', 'Cierre solicitado')
  ) then
    raise exception 'La caja tiene una sesion activa: cerrala antes de modificarla' using errcode = 'CJV03';
  end if;

  update public.cajav2_registradora
  set numero = p_numero,
      nombre = nullif(btrim(p_nombre), ''),
      id_deposito = p_id_deposito,
      activa = coalesce(p_activa, activa),
      editado = now()
  where id_registradora = p_id_registradora
  returning * into v_reg;

  if v_reg.id_registradora is null then
    raise exception 'La caja indicada no existe' using errcode = 'CJV02';
  end if;
  return v_reg;
exception
  when unique_violation then
    raise exception 'Ya existe una caja con el numero %', p_numero using errcode = 'CJV02';
end;
$$;

-- ---------------------------------------------------------------------------
-- Lecturas
-- ---------------------------------------------------------------------------

-- Panel: todas las cajas fisicas (activas e inactivas) con su sesion viva (o null).
create function public.fn_cajav2_panel()
returns jsonb
language sql
stable
set search_path to 'public'
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id_registradora', r.id_registradora,
    'numero', r.numero,
    'nombre', r.nombre,
    'activa', r.activa,
    'id_deposito', r.id_deposito,
    'nombre_deposito', d.nombre_deposito,
    'sesion', case when v.id_sesion is null then null else to_jsonb(v) || jsonb_build_object(
      'saldo_efectivo',
        case when v.id_caja is null then null
             else (public.fn_caja_resumen(v.id_caja)->'efectivo'->>'saldo_teorico')::numeric end,
      'total_ingresos',
        case when v.id_caja is null then null
             else (public.fn_caja_resumen(v.id_caja)->>'total_ingresos')::numeric end
    ) end
  ) order by r.numero), '[]'::jsonb)
  from public.cajav2_registradora r
  join public.deposito d on d.id_deposito = r.id_deposito
  left join public.cajav2_vw_sesion v
    on v.id_registradora = r.id_registradora
   and v.estado in ('Pendiente', 'Abierta', 'Cierre solicitado');
$$;

-- Sesion viva del usuario actual (o null).
create function public.fn_cajav2_mi_sesion()
returns jsonb
language sql
stable
set search_path to 'public'
as $$
  select to_jsonb(v)
  from public.cajav2_vw_sesion v
  where v.id_empleado = auth.uid()
    and v.estado in ('Pendiente', 'Abierta', 'Cierre solicitado');
$$;

-- Sesion cajav2 de una caja (null si es una caja vieja).
create function public.fn_cajav2_sesion_de_caja(p_id_caja uuid)
returns jsonb
language sql
stable
set search_path to 'public'
as $$
  select to_jsonb(v) from public.cajav2_vw_sesion v where v.id_caja = p_id_caja;
$$;

-- ---------------------------------------------------------------------------
-- Flujo de la sesion
-- ---------------------------------------------------------------------------

create function public.fn_cajav2_solicitar_apertura(
  p_id_registradora uuid,
  p_monto_inicial numeric,
  p_observaciones text
)
returns public.cajav2_sesion
language plpgsql
set search_path to 'public'
as $$
declare
  v_reg    public.cajav2_registradora;
  v_sesion public.cajav2_sesion;
  v_otra   integer;
begin
  if p_monto_inicial is null or p_monto_inicial < 0 then
    raise exception 'El monto inicial en efectivo es obligatorio y no puede ser negativo' using errcode = 'CJV02';
  end if;

  select * into v_reg from public.cajav2_registradora where id_registradora = p_id_registradora;
  if v_reg.id_registradora is null or not v_reg.activa then
    raise exception 'La caja elegida no existe o esta inactiva' using errcode = 'CJV02';
  end if;

  select r.numero into v_otra
  from public.cajav2_sesion s
  join public.cajav2_registradora r on r.id_registradora = s.id_registradora
  where s.id_empleado = auth.uid()
    and s.estado in ('Pendiente', 'Abierta', 'Cierre solicitado');
  if v_otra is not null then
    raise exception 'Ya tenes una sesion activa en la caja %', v_otra using errcode = 'CJV03';
  end if;

  if exists (
    select 1 from public.cajav2_sesion
    where id_registradora = p_id_registradora
      and estado in ('Pendiente', 'Abierta', 'Cierre solicitado')
  ) then
    raise exception 'La caja % esta ocupada', v_reg.numero using errcode = 'CJV03';
  end if;

  insert into public.cajav2_sesion (id_registradora, id_empleado, monto_inicial, observaciones_apertura)
  values (p_id_registradora, auth.uid(), round(p_monto_inicial, 2), nullif(btrim(p_observaciones), ''))
  returning * into v_sesion;

  return v_sesion;
exception
  when unique_violation then
    raise exception 'La caja esta ocupada o ya tenes una sesion activa' using errcode = 'CJV03';
end;
$$;

-- El gerente aprueba: recien ahi nace la caja (public.caja) y empieza a correr la sesion.
create function public.fn_cajav2_aprobar_apertura(p_id_sesion uuid)
returns public.cajav2_sesion
language plpgsql
set search_path to 'public'
as $$
declare
  v_sesion public.cajav2_sesion;
  v_reg    public.cajav2_registradora;
  v_caja   public.caja;
begin
  if not public.fn_cajav2_es_gerente() then
    raise exception 'Solo el gerente puede autorizar la apertura' using errcode = 'CJV01';
  end if;
  select * into v_sesion from public.cajav2_sesion where id_sesion = p_id_sesion for update;
  if v_sesion.id_sesion is null or v_sesion.estado <> 'Pendiente' then
    raise exception 'La sesion no esta pendiente de aprobacion' using errcode = 'CJV04';
  end if;
  select * into v_reg from public.cajav2_registradora where id_registradora = v_sesion.id_registradora;
  if not exists (select 1 from public.deposito where id_deposito = v_reg.id_deposito and activo) then
    raise exception 'El deposito de la caja esta inactivo' using errcode = 'CJV02';
  end if;

  insert into public.caja (punto_venta, id_deposito, monto_inicial, abierta_por, observaciones_apertura)
  values (v_reg.numero, v_reg.id_deposito, v_sesion.monto_inicial, v_sesion.id_empleado,
          v_sesion.observaciones_apertura)
  returning * into v_caja;

  update public.cajav2_sesion
  set estado = 'Abierta',
      id_caja = v_caja.id_caja,
      autorizada_por = auth.uid(),
      fecha_autorizacion = now(),
      editado = now()
  where id_sesion = p_id_sesion
  returning * into v_sesion;

  return v_sesion;
end;
$$;

create function public.fn_cajav2_rechazar_apertura(p_id_sesion uuid, p_motivo text)
returns public.cajav2_sesion
language plpgsql
set search_path to 'public'
as $$
declare
  v_sesion public.cajav2_sesion;
begin
  if not public.fn_cajav2_es_gerente() then
    raise exception 'Solo el gerente puede rechazar la apertura' using errcode = 'CJV01';
  end if;
  select * into v_sesion from public.cajav2_sesion where id_sesion = p_id_sesion for update;
  if v_sesion.id_sesion is null or v_sesion.estado <> 'Pendiente' then
    raise exception 'La sesion no esta pendiente de aprobacion' using errcode = 'CJV04';
  end if;

  update public.cajav2_sesion
  set estado = 'Rechazada',
      motivo_rechazo = nullif(btrim(p_motivo), ''),
      autorizada_por = auth.uid(),
      fecha_autorizacion = now(),
      fecha_fin = now(),
      editado = now()
  where id_sesion = p_id_sesion
  returning * into v_sesion;

  return v_sesion;
end;
$$;

-- El empleado (o el gerente) pide el cierre despues de un arqueo al dia.
create function public.fn_cajav2_solicitar_cierre(p_id_sesion uuid, p_observaciones text)
returns public.cajav2_sesion
language plpgsql
set search_path to 'public'
as $$
declare
  v_sesion  public.cajav2_sesion;
  v_arqueo  timestamptz;
  v_ult_mov timestamptz;
begin
  select * into v_sesion from public.cajav2_sesion where id_sesion = p_id_sesion for update;
  if v_sesion.id_sesion is null or v_sesion.estado <> 'Abierta' then
    raise exception 'La caja no esta abierta' using errcode = 'CJV04';
  end if;
  if v_sesion.id_empleado is distinct from auth.uid() and not public.fn_cajav2_es_gerente() then
    raise exception 'Solo el empleado asignado a la caja puede pedir el cierre' using errcode = 'CJV06';
  end if;

  select max(creado) into v_arqueo from public.arqueo_caja where id_caja = v_sesion.id_caja;
  if v_arqueo is null then
    raise exception 'Antes de pedir el cierre tenes que realizar el arqueo' using errcode = 'CJV04';
  end if;
  select max(creado) into v_ult_mov from public.movimiento_caja where id_caja = v_sesion.id_caja;
  if v_ult_mov is not null and v_ult_mov >= v_arqueo then
    raise exception 'Hubo movimientos despues del ultimo arqueo. Realiza un nuevo arqueo antes de pedir el cierre'
      using errcode = 'CJV04';
  end if;

  update public.cajav2_sesion
  set estado = 'Cierre solicitado',
      fecha_solicitud_cierre = now(),
      observaciones_cierre = nullif(btrim(p_observaciones), ''),
      editado = now()
  where id_sesion = p_id_sesion
  returning * into v_sesion;

  return v_sesion;
end;
$$;

create function public.fn_cajav2_rechazar_cierre(p_id_sesion uuid, p_motivo text)
returns public.cajav2_sesion
language plpgsql
set search_path to 'public'
as $$
declare
  v_sesion public.cajav2_sesion;
begin
  if not public.fn_cajav2_es_gerente() then
    raise exception 'Solo el gerente puede rechazar el cierre' using errcode = 'CJV01';
  end if;
  select * into v_sesion from public.cajav2_sesion where id_sesion = p_id_sesion for update;
  if v_sesion.id_sesion is null or v_sesion.estado <> 'Cierre solicitado' then
    raise exception 'La caja no tiene un cierre pendiente' using errcode = 'CJV04';
  end if;

  update public.cajav2_sesion
  set estado = 'Abierta',
      fecha_solicitud_cierre = null,
      motivo_rechazo = nullif(btrim(p_motivo), ''),
      editado = now()
  where id_sesion = p_id_sesion
  returning * into v_sesion;

  return v_sesion;
end;
$$;

-- Cierre definitivo del gerente: reusa fn_caja_cerrar (arqueo al dia, resumen).
-- trg_cajav2_sincronizar_cierre pasa la sesion a 'Cerrada'.
create function public.fn_cajav2_cerrar(p_id_sesion uuid, p_observaciones text)
returns public.caja
language plpgsql
set search_path to 'public'
as $$
declare
  v_sesion public.cajav2_sesion;
begin
  if not public.fn_cajav2_es_gerente() then
    raise exception 'Solo el gerente puede cerrar la caja' using errcode = 'CJV01';
  end if;
  select * into v_sesion from public.cajav2_sesion where id_sesion = p_id_sesion for update;
  if v_sesion.id_sesion is null or v_sesion.estado not in ('Abierta', 'Cierre solicitado') then
    raise exception 'La caja no esta abierta' using errcode = 'CJV04';
  end if;

  return public.fn_caja_cerrar(
    v_sesion.id_caja,
    coalesce(nullif(btrim(p_observaciones), ''), v_sesion.observaciones_cierre),
    auth.uid()
  );
end;
$$;

notify pgrst, 'reload schema';
