-- Sprint 4 · Cajas (V-14, V-15, V-17, V-18) + V-21 (venta minorista / consumidor final)
--
-- La caja es independiente de tesorería: no toca cuenta_tesoreria ni crea cobro.
-- Las ventas minoristas y de consumidor final se cobran en la caja abierta al
-- registrarlas y quedan "Pagado" directo. Un solo punto de venta (el 1).
--
-- Saldo teórico de efectivo = monto_inicial + ingresos − egresos en efectivo.
-- Solo el efectivo se compara con lo contado; el resto de los medios se muestra aparte.
--
-- Códigos de error:
--   CAJ01 ya hay una caja abierta en el punto de venta
--   CAJ02 monto inicial inválido
--   CAJ03 caja inexistente
--   CAJ04 caja cerrada / no hay caja abierta
--   CAJ05 movimiento inválido (tipo, importe o motivo)
--   CAJ06 medio de pago inexistente, inactivo o cheque propio
--   CAJ07 el medio requiere referencia
--   CAJ08 egreso mayor al saldo disponible del medio
--   CAJ09 medios de cobro vacíos o suma distinta del total
--   CAJ10 la venta no se puede cobrar en caja (mayorista / ya cobrada)
--   CAJ11 saldo físico del arqueo inválido
--   CAJ12 cierre sin arqueo posterior al último movimiento
--   CAJ13 movimientos y arqueos inmutables
--   VTA15 la venta mayorista no admite medios de cobro en caja

-- ---------------------------------------------------------------------------
-- Mercado Pago (simulado)
-- ---------------------------------------------------------------------------

insert into public.medio_pago (nombre_medio_pago, tipo, requiere_referencia, creado_por)
select 'Mercado Pago (simulado)', 'Mercado Pago', false,
       coalesce(auth.uid(), (select id from auth.users order by created_at limit 1))
where not exists (
  select 1 from public.medio_pago where lower(nombre_medio_pago) = lower('Mercado Pago (simulado)')
);

-- ---------------------------------------------------------------------------
-- Tipos y tablas
-- ---------------------------------------------------------------------------

create type public.estado_caja as enum ('Abierta', 'Cerrada');
create type public.tipo_venta as enum ('Mayorista', 'Minorista', 'Consumidor final');

create table public.caja (
  id_caja                uuid primary key default gen_random_uuid(),
  punto_venta            integer not null default 1 check (punto_venta > 0),
  estado                 public.estado_caja not null default 'Abierta',
  monto_inicial          numeric(14,2) not null check (monto_inicial >= 0),
  fecha_apertura         timestamptz not null default now(),
  abierta_por            uuid not null default auth.uid(),
  observaciones_apertura text,
  fecha_cierre           timestamptz,
  cerrada_por            uuid,
  observaciones_cierre   text,
  id_arqueo_cierre       uuid,
  total_ingresos         numeric(14,2),
  total_egresos          numeric(14,2),
  saldo_teorico_efectivo numeric(14,2),
  saldo_fisico_efectivo  numeric(14,2),
  diferencia_efectivo    numeric(14,2),
  resumen_cierre         jsonb,
  editado                timestamptz not null default now(),
  constraint chk_caja_cierre check (
    (estado = 'Abierta' and fecha_cierre is null and cerrada_por is null)
    or (estado = 'Cerrada' and fecha_cierre is not null and cerrada_por is not null and id_arqueo_cierre is not null)
  )
);

-- V-14: una sola caja abierta por punto de venta.
create unique index caja_una_abierta_por_punto_venta
  on public.caja (punto_venta) where estado = 'Abierta';
create index caja_fecha_apertura_idx on public.caja (fecha_apertura desc);

create table public.movimiento_caja (
  id_movimiento_caja uuid primary key default gen_random_uuid(),
  id_caja            uuid not null references public.caja (id_caja),
  tipo               public.tipo_movimiento_tesoreria not null,
  id_medio_pago      uuid not null references public.medio_pago (id_medio_pago),
  importe            numeric(14,2) not null check (importe > 0),
  motivo             text not null check (length(btrim(motivo)) > 0),
  referencia         text,
  id_comprobante     uuid references public.comprobante_venta (id_comprobante),
  creado             timestamptz not null default clock_timestamp(),
  creado_por         uuid not null default auth.uid()
);

create index movimiento_caja_caja_idx on public.movimiento_caja (id_caja, creado);
create index movimiento_caja_comprobante_idx on public.movimiento_caja (id_comprobante);

create table public.arqueo_caja (
  id_arqueo      uuid primary key default gen_random_uuid(),
  id_caja        uuid not null references public.caja (id_caja),
  saldo_teorico  numeric(14,2) not null,
  saldo_fisico   numeric(14,2) not null check (saldo_fisico >= 0),
  diferencia     numeric(14,2) generated always as (saldo_fisico - saldo_teorico) stored,
  detalle_medios jsonb not null default '[]'::jsonb,
  observaciones  text,
  creado         timestamptz not null default clock_timestamp(),
  creado_por     uuid not null default auth.uid()
);

create index arqueo_caja_caja_idx on public.arqueo_caja (id_caja, creado desc);

alter table public.caja
  add constraint caja_arqueo_cierre_fk foreign key (id_arqueo_cierre) references public.arqueo_caja (id_arqueo);

alter table public.comprobante_venta
  add column tipo_venta public.tipo_venta not null default 'Mayorista',
  add column id_caja uuid references public.caja (id_caja);

create index comprobante_venta_caja_idx on public.comprobante_venta (id_caja);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- V-18: una caja cerrada no se modifica; la apertura no se pisa.
create or replace function public.fn_caja_proteger()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if old.estado = 'Cerrada' then
    raise exception 'La caja ya esta cerrada y no admite cambios' using errcode = 'CAJ04';
  end if;
  new.punto_venta    := old.punto_venta;
  new.monto_inicial  := old.monto_inicial;
  new.fecha_apertura := old.fecha_apertura;
  new.abierta_por    := old.abierta_por;
  new.editado        := now();
  return new;
end;
$$;

create trigger trg_caja_proteger
before update on public.caja
for each row execute function public.fn_caja_proteger();

-- V-15 / V-18: movimientos y arqueos solo sobre caja abierta, e inmutables.
create or replace function public.fn_caja_validar_registro()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_estado public.estado_caja;
begin
  if tg_op <> 'INSERT' then
    raise exception 'Los movimientos y arqueos de caja no se pueden modificar ni eliminar'
      using errcode = 'CAJ13';
  end if;

  select estado into v_estado from public.caja where id_caja = new.id_caja;
  if v_estado is null then
    raise exception 'La caja indicada no existe' using errcode = 'CAJ03';
  end if;
  if v_estado <> 'Abierta' then
    raise exception 'La caja esta cerrada y no admite nuevos movimientos' using errcode = 'CAJ04';
  end if;
  return new;
end;
$$;

create trigger trg_movimiento_caja_validar
before insert or update or delete on public.movimiento_caja
for each row execute function public.fn_caja_validar_registro();

create trigger trg_arqueo_caja_validar
before insert or update or delete on public.arqueo_caja
for each row execute function public.fn_caja_validar_registro();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.caja enable row level security;
alter table public.movimiento_caja enable row level security;
alter table public.arqueo_caja enable row level security;

create policy caja_select_authenticated on public.caja
  for select to authenticated using (true);
create policy caja_insert_authenticated on public.caja
  for insert to authenticated with check (true);
create policy caja_update_authenticated on public.caja
  for update to authenticated using (true) with check (true);

create policy movimiento_caja_select_authenticated on public.movimiento_caja
  for select to authenticated using (true);
create policy movimiento_caja_insert_authenticated on public.movimiento_caja
  for insert to authenticated with check (true);

create policy arqueo_caja_select_authenticated on public.arqueo_caja
  for select to authenticated using (true);
create policy arqueo_caja_insert_authenticated on public.arqueo_caja
  for insert to authenticated with check (true);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Valida un medio para operar en caja y devuelve la referencia a guardar.
-- Mercado Pago (simulado) se confirma siempre: si no trae referencia se genera una.
create or replace function public._fn_caja_medio_validar(p_id_medio_pago uuid, p_referencia text)
returns text
language plpgsql
set search_path to 'public'
as $$
declare
  v_medio public.medio_pago;
  v_ref   text := nullif(btrim(p_referencia), '');
begin
  select * into v_medio from public.medio_pago where id_medio_pago = p_id_medio_pago;
  if v_medio.id_medio_pago is null then
    raise exception 'Uno de los medios de pago no existe' using errcode = 'CAJ06';
  end if;
  if v_medio.activo = false then
    raise exception 'El medio de pago "%" esta inactivo', v_medio.nombre_medio_pago using errcode = 'CAJ06';
  end if;
  if v_medio.tipo = 'Cheque propio' then
    raise exception 'La caja no opera con cheque propio' using errcode = 'CAJ06';
  end if;
  if v_medio.tipo = 'Mercado Pago' and v_ref is null then
    v_ref := 'MP-SIM-' || upper(substr(md5(gen_random_uuid()::text), 1, 10));
  end if;
  if v_medio.requiere_referencia and v_ref is null then
    raise exception 'El medio de pago "%" requiere una referencia', v_medio.nombre_medio_pago using errcode = 'CAJ07';
  end if;
  return v_ref;
end;
$$;

-- ---------------------------------------------------------------------------
-- V-17 · Resumen de la caja (saldos por medio de pago)
-- ---------------------------------------------------------------------------

create or replace function public.fn_caja_resumen(p_id_caja uuid)
returns jsonb
language sql
stable
set search_path to 'public'
as $$
  with c as (
    select * from public.caja where id_caja = p_id_caja
  ),
  mov as (
    select m.id_medio_pago,
           sum(case when m.tipo = 'Ingreso' then m.importe else 0 end) as ingresos,
           sum(case when m.tipo = 'Egreso' then m.importe else 0 end) as egresos,
           count(*) as cantidad
    from public.movimiento_caja m
    where m.id_caja = p_id_caja
    group by m.id_medio_pago
  ),
  medios as (
    select mp.id_medio_pago, mp.nombre_medio_pago, mp.tipo,
           coalesce(mov.ingresos, 0) as ingresos,
           coalesce(mov.egresos, 0) as egresos
    from public.medio_pago mp
    left join mov on mov.id_medio_pago = mp.id_medio_pago
    where mov.id_medio_pago is not null or (mp.tipo = 'Efectivo' and mp.activo)
  ),
  efectivo as (
    select coalesce(sum(ingresos), 0) as ingresos, coalesce(sum(egresos), 0) as egresos
    from medios where tipo = 'Efectivo'
  ),
  ult_mov as (
    select max(creado) as creado from public.movimiento_caja where id_caja = p_id_caja
  ),
  ult_arq as (
    select a.* from public.arqueo_caja a
    where a.id_caja = p_id_caja
    order by a.creado desc
    limit 1
  )
  select case when c.id_caja is null then null else jsonb_build_object(
    'monto_inicial', c.monto_inicial,
    'total_ingresos', (select coalesce(sum(ingresos), 0) from medios),
    'total_egresos', (select coalesce(sum(egresos), 0) from medios),
    'cantidad_movimientos', (select coalesce(sum(cantidad), 0) from mov),
    'efectivo', jsonb_build_object(
      'monto_inicial', c.monto_inicial,
      'ingresos', e.ingresos,
      'egresos', e.egresos,
      'saldo_teorico', round(c.monto_inicial + e.ingresos - e.egresos, 2)
    ),
    'medios', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id_medio_pago', md.id_medio_pago,
        'nombre_medio_pago', md.nombre_medio_pago,
        'tipo', md.tipo,
        'es_efectivo', md.tipo = 'Efectivo',
        'simulado', md.tipo = 'Mercado Pago',
        'ingresos', md.ingresos,
        'egresos', md.egresos,
        'saldo', round(md.ingresos - md.egresos, 2)
      ) order by md.tipo <> 'Efectivo', md.nombre_medio_pago)
      from medios md
    ), '[]'::jsonb),
    'ultimo_movimiento', (select creado from ult_mov),
    'ultimo_arqueo', (
      select jsonb_build_object(
        'id_arqueo', a.id_arqueo,
        'saldo_teorico', a.saldo_teorico,
        'saldo_fisico', a.saldo_fisico,
        'diferencia', a.diferencia,
        'creado', a.creado
      ) from ult_arq a
    ),
    'arqueo_al_dia', exists (
      select 1 from ult_arq a, ult_mov um
      where um.creado is null or a.creado > um.creado
    )
  ) end
  from c
  cross join efectivo e;
$$;

-- ---------------------------------------------------------------------------
-- V-14 · Abrir caja
-- ---------------------------------------------------------------------------

create or replace function public.fn_caja_abrir(
  p_monto_inicial numeric,
  p_observaciones text,
  p_creado_por uuid,
  p_punto_venta integer default 1
)
returns public.caja
language plpgsql
set search_path to 'public'
as $$
declare
  v_pv      integer := coalesce(p_punto_venta, 1);
  v_abierta record;
  v_caja    public.caja;
begin
  if p_monto_inicial is null or p_monto_inicial < 0 then
    raise exception 'El monto inicial en efectivo es obligatorio y no puede ser negativo' using errcode = 'CAJ02';
  end if;
  if v_pv <= 0 then
    raise exception 'El punto de venta no es valido' using errcode = 'CAJ02';
  end if;

  select c.fecha_apertura, coalesce(u.nombre_completo, 'otro usuario') as quien
    into v_abierta
  from public.caja c
  left join public.vw_usuario_resumen u on u.id_usuario = c.abierta_por
  where c.punto_venta = v_pv and c.estado = 'Abierta';

  if v_abierta.fecha_apertura is not null then
    raise exception 'Ya hay una caja abierta en el punto de venta %: la abrio % el %',
      v_pv, v_abierta.quien, to_char(v_abierta.fecha_apertura at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI')
      using errcode = 'CAJ01';
  end if;

  begin
    insert into public.caja (punto_venta, monto_inicial, abierta_por, observaciones_apertura)
    values (v_pv, round(p_monto_inicial, 2), coalesce(p_creado_por, auth.uid()), nullif(btrim(p_observaciones), ''))
    returning * into v_caja;
  exception
    when unique_violation then
      raise exception 'Ya hay una caja abierta en el punto de venta %', v_pv using errcode = 'CAJ01';
  end;

  return v_caja;
end;
$$;

-- ---------------------------------------------------------------------------
-- Consulta de cajas
-- ---------------------------------------------------------------------------

create or replace function public.fn_caja_obtener(p_id_caja uuid)
returns jsonb
language sql
stable
set search_path to 'public'
as $$
  select jsonb_build_object(
    'caja', jsonb_build_object(
      'id_caja', c.id_caja,
      'punto_venta', c.punto_venta,
      'estado', c.estado,
      'monto_inicial', c.monto_inicial,
      'fecha_apertura', c.fecha_apertura,
      'abierta_por', c.abierta_por,
      'abierta_por_nombre', coalesce(ua.nombre_completo, 'Usuario no disponible'),
      'observaciones_apertura', c.observaciones_apertura,
      'fecha_cierre', c.fecha_cierre,
      'cerrada_por', c.cerrada_por,
      'cerrada_por_nombre', uc.nombre_completo,
      'observaciones_cierre', c.observaciones_cierre,
      'total_ingresos', c.total_ingresos,
      'total_egresos', c.total_egresos,
      'saldo_teorico_efectivo', c.saldo_teorico_efectivo,
      'saldo_fisico_efectivo', c.saldo_fisico_efectivo,
      'diferencia_efectivo', c.diferencia_efectivo,
      'resumen_cierre', c.resumen_cierre
    ),
    'resumen', public.fn_caja_resumen(c.id_caja),
    'movimientos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id_movimiento_caja', m.id_movimiento_caja,
        'tipo', m.tipo,
        'id_medio_pago', m.id_medio_pago,
        'nombre_medio_pago', mp.nombre_medio_pago,
        'tipo_medio', mp.tipo,
        'importe', m.importe,
        'motivo', m.motivo,
        'referencia', m.referencia,
        'id_comprobante', m.id_comprobante,
        'comprobante', case when v.id_comprobante is null then null
          else tc.nombre_tipo_comprobante || ' ' || lpad(v.punto_venta::text, 5, '0') || '-' || lpad(v.numero::text, 8, '0') end,
        'creado', m.creado,
        'creado_por_nombre', coalesce(um.nombre_completo, 'Usuario no disponible')
      ) order by m.creado desc)
      from public.movimiento_caja m
      join public.medio_pago mp on mp.id_medio_pago = m.id_medio_pago
      left join public.comprobante_venta v on v.id_comprobante = m.id_comprobante
      left join public.tipo_comprobante tc on tc.id_tipo_comprobante = v.id_tipo_comprobante
      left join public.vw_usuario_resumen um on um.id_usuario = m.creado_por
      where m.id_caja = c.id_caja
    ), '[]'::jsonb),
    'arqueos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id_arqueo', a.id_arqueo,
        'saldo_teorico', a.saldo_teorico,
        'saldo_fisico', a.saldo_fisico,
        'diferencia', a.diferencia,
        'detalle_medios', a.detalle_medios,
        'observaciones', a.observaciones,
        'creado', a.creado,
        'creado_por_nombre', coalesce(uq.nombre_completo, 'Usuario no disponible')
      ) order by a.creado desc)
      from public.arqueo_caja a
      left join public.vw_usuario_resumen uq on uq.id_usuario = a.creado_por
      where a.id_caja = c.id_caja
    ), '[]'::jsonb)
  )
  from public.caja c
  left join public.vw_usuario_resumen ua on ua.id_usuario = c.abierta_por
  left join public.vw_usuario_resumen uc on uc.id_usuario = c.cerrada_por
  where c.id_caja = p_id_caja;
$$;

create or replace function public.fn_caja_obtener_abierta(p_punto_venta integer default 1)
returns jsonb
language sql
stable
set search_path to 'public'
as $$
  select public.fn_caja_obtener(c.id_caja)
  from public.caja c
  where c.punto_venta = coalesce(p_punto_venta, 1) and c.estado = 'Abierta';
$$;

create or replace function public.fn_caja_listar(
  p_desde date default null,
  p_hasta date default null,
  p_estado public.estado_caja default null
)
returns table (
  id_caja uuid,
  punto_venta integer,
  estado public.estado_caja,
  monto_inicial numeric,
  fecha_apertura timestamptz,
  abierta_por_nombre text,
  fecha_cierre timestamptz,
  cerrada_por_nombre text,
  total_ingresos numeric,
  total_egresos numeric,
  saldo_teorico_efectivo numeric,
  saldo_fisico_efectivo numeric,
  diferencia_efectivo numeric,
  cantidad_movimientos bigint
)
language sql
stable
set search_path to 'public'
as $$
  select
    c.id_caja,
    c.punto_venta,
    c.estado,
    c.monto_inicial,
    c.fecha_apertura,
    coalesce(ua.nombre_completo, 'Usuario no disponible'),
    c.fecha_cierre,
    uc.nombre_completo,
    coalesce(c.total_ingresos, m.ingresos),
    coalesce(c.total_egresos, m.egresos),
    c.saldo_teorico_efectivo,
    c.saldo_fisico_efectivo,
    c.diferencia_efectivo,
    m.cantidad
  from public.caja c
  left join public.vw_usuario_resumen ua on ua.id_usuario = c.abierta_por
  left join public.vw_usuario_resumen uc on uc.id_usuario = c.cerrada_por
  cross join lateral (
    select coalesce(sum(case when mc.tipo = 'Ingreso' then mc.importe end), 0) as ingresos,
           coalesce(sum(case when mc.tipo = 'Egreso' then mc.importe end), 0) as egresos,
           count(mc.*) as cantidad
    from public.movimiento_caja mc
    where mc.id_caja = c.id_caja
  ) m
  where (p_desde is null or (c.fecha_apertura at time zone 'America/Argentina/Buenos_Aires')::date >= p_desde)
    and (p_hasta is null or (c.fecha_apertura at time zone 'America/Argentina/Buenos_Aires')::date <= p_hasta)
    and (p_estado is null or c.estado = p_estado)
  order by c.fecha_apertura desc;
$$;

-- ---------------------------------------------------------------------------
-- V-15 · Ingresos y egresos manuales
-- ---------------------------------------------------------------------------

create or replace function public.fn_caja_movimiento_registrar(
  p_id_caja uuid,
  p_tipo public.tipo_movimiento_tesoreria,
  p_id_medio_pago uuid,
  p_importe numeric,
  p_motivo text,
  p_referencia text,
  p_creado_por uuid
)
returns public.movimiento_caja
language plpgsql
set search_path to 'public'
as $$
declare
  v_caja       public.caja;
  v_ref        text;
  v_tipo_medio public.tipo_medio_pago;
  v_nombre     text;
  v_disponible numeric;
  v_mov        public.movimiento_caja;
begin
  select * into v_caja from public.caja where id_caja = p_id_caja for update;
  if v_caja.id_caja is null then
    raise exception 'La caja indicada no existe' using errcode = 'CAJ03';
  end if;
  if v_caja.estado <> 'Abierta' then
    raise exception 'La caja esta cerrada y no admite nuevos movimientos' using errcode = 'CAJ04';
  end if;

  if p_tipo is null then
    raise exception 'Indica si el movimiento es un ingreso o un egreso' using errcode = 'CAJ05';
  end if;
  if p_importe is null or p_importe <= 0 then
    raise exception 'El importe debe ser mayor a cero' using errcode = 'CAJ05';
  end if;
  if nullif(btrim(p_motivo), '') is null then
    raise exception 'El motivo del movimiento es obligatorio' using errcode = 'CAJ05';
  end if;

  v_ref := public._fn_caja_medio_validar(p_id_medio_pago, p_referencia);

  if p_tipo = 'Egreso' then
    select tipo, nombre_medio_pago into v_tipo_medio, v_nombre
    from public.medio_pago where id_medio_pago = p_id_medio_pago;

    if v_tipo_medio = 'Efectivo' then
      v_disponible := (public.fn_caja_resumen(p_id_caja)->'efectivo'->>'saldo_teorico')::numeric;
    else
      select coalesce(sum(case when tipo = 'Ingreso' then importe else -importe end), 0)
        into v_disponible
      from public.movimiento_caja
      where id_caja = p_id_caja and id_medio_pago = p_id_medio_pago;
    end if;

    if round(p_importe, 2) > round(v_disponible, 2) then
      raise exception 'El egreso (%) supera el saldo disponible en % (%)',
        to_char(round(p_importe, 2), 'FM999999999990.00'), v_nombre,
        to_char(round(v_disponible, 2), 'FM999999999990.00')
        using errcode = 'CAJ08';
    end if;
  end if;

  insert into public.movimiento_caja (id_caja, tipo, id_medio_pago, importe, motivo, referencia, creado_por)
  values (p_id_caja, p_tipo, p_id_medio_pago, round(p_importe, 2), btrim(p_motivo), v_ref,
          coalesce(p_creado_por, auth.uid()))
  returning * into v_mov;

  return v_mov;
end;
$$;

-- ---------------------------------------------------------------------------
-- V-15 / V-21 · Cobro de venta minorista o consumidor final en caja
-- ---------------------------------------------------------------------------
-- p_medios: [{ id_medio_pago, importe, referencia? }]. La suma tiene que ser el total.

create or replace function public.fn_caja_registrar_cobro_venta(
  p_id_comprobante uuid,
  p_medios jsonb,
  p_creado_por uuid
)
returns uuid
language plpgsql
set search_path to 'public'
as $$
declare
  v_venta  public.comprobante_venta;
  v_caja   public.caja;
  v_motivo text;
  v_suma   numeric;
  v_ref    text;
  r        record;
begin
  select * into v_venta from public.comprobante_venta where id_comprobante = p_id_comprobante for update;
  if v_venta.id_comprobante is null then
    raise exception 'La venta indicada no existe' using errcode = 'VTA09';
  end if;
  if v_venta.tipo_venta = 'Mayorista' then
    raise exception 'Las ventas mayoristas se cobran en Tesoreria, no en caja' using errcode = 'CAJ10';
  end if;
  if v_venta.estado <> 'En preparación'
     or exists (select 1 from public.movimiento_caja where id_comprobante = p_id_comprobante) then
    raise exception 'La venta ya esta cobrada' using errcode = 'CAJ10';
  end if;

  select * into v_caja
  from public.caja
  where punto_venta = v_venta.punto_venta and estado = 'Abierta'
  for update;
  if v_caja.id_caja is null then
    raise exception 'No hay una caja abierta en el punto de venta %. Abri la caja para cobrar la venta', v_venta.punto_venta
      using errcode = 'CAJ04';
  end if;

  if p_medios is null or jsonb_typeof(p_medios) <> 'array' or jsonb_array_length(p_medios) = 0 then
    raise exception 'La venta debe cobrarse con al menos un medio de pago' using errcode = 'CAJ09';
  end if;

  for r in
    select (e.value->>'importe')::numeric as importe
    from jsonb_array_elements(p_medios) as e(value)
  loop
    if r.importe is null or r.importe <= 0 then
      raise exception 'El importe de cada medio de pago debe ser mayor a cero' using errcode = 'CAJ09';
    end if;
  end loop;

  select round(coalesce(sum((e.value->>'importe')::numeric), 0), 2) into v_suma
  from jsonb_array_elements(p_medios) as e(value);
  if v_suma <> round(v_venta.importe_total, 2) then
    raise exception 'La suma de los medios (%) tiene que ser igual al total de la venta (%)',
      to_char(v_suma, 'FM999999999990.00'), to_char(round(v_venta.importe_total, 2), 'FM999999999990.00')
      using errcode = 'CAJ09';
  end if;

  select 'Venta ' || tc.nombre_tipo_comprobante || ' '
         || lpad(v_venta.punto_venta::text, 5, '0') || '-' || lpad(v_venta.numero::text, 8, '0')
    into v_motivo
  from public.tipo_comprobante tc
  where tc.id_tipo_comprobante = v_venta.id_tipo_comprobante;

  for r in
    select (e.value->>'id_medio_pago')::uuid as id_medio_pago,
           round((e.value->>'importe')::numeric, 2) as importe,
           e.value->>'referencia' as referencia
    from jsonb_array_elements(p_medios) with ordinality as e(value, ord)
    order by e.ord
  loop
    v_ref := public._fn_caja_medio_validar(r.id_medio_pago, r.referencia);
    insert into public.movimiento_caja (id_caja, tipo, id_medio_pago, importe, motivo, referencia, id_comprobante, creado_por)
    values (v_caja.id_caja, 'Ingreso', r.id_medio_pago, r.importe, v_motivo, v_ref, v_venta.id_comprobante,
            coalesce(p_creado_por, auth.uid()));
  end loop;

  update public.comprobante_venta
  set estado = 'Pagado', saldo_pendiente = 0, id_caja = v_caja.id_caja
  where id_comprobante = v_venta.id_comprobante;

  return v_caja.id_caja;
end;
$$;

-- ---------------------------------------------------------------------------
-- V-17 · Arqueo
-- ---------------------------------------------------------------------------

create or replace function public.fn_caja_arqueo_realizar(
  p_id_caja uuid,
  p_saldo_fisico numeric,
  p_observaciones text,
  p_creado_por uuid
)
returns public.arqueo_caja
language plpgsql
set search_path to 'public'
as $$
declare
  v_caja    public.caja;
  v_resumen jsonb;
  v_arqueo  public.arqueo_caja;
begin
  select * into v_caja from public.caja where id_caja = p_id_caja for update;
  if v_caja.id_caja is null then
    raise exception 'La caja indicada no existe' using errcode = 'CAJ03';
  end if;
  if v_caja.estado <> 'Abierta' then
    raise exception 'La caja esta cerrada' using errcode = 'CAJ04';
  end if;
  if p_saldo_fisico is null or p_saldo_fisico < 0 then
    raise exception 'Ingresa el efectivo contado (cero o mas)' using errcode = 'CAJ11';
  end if;

  v_resumen := public.fn_caja_resumen(p_id_caja);

  insert into public.arqueo_caja (id_caja, saldo_teorico, saldo_fisico, detalle_medios, observaciones, creado_por)
  values (
    p_id_caja,
    (v_resumen->'efectivo'->>'saldo_teorico')::numeric,
    round(p_saldo_fisico, 2),
    v_resumen->'medios',
    nullif(btrim(p_observaciones), ''),
    coalesce(p_creado_por, auth.uid())
  )
  returning * into v_arqueo;

  return v_arqueo;
end;
$$;

-- ---------------------------------------------------------------------------
-- V-18 · Cierre
-- ---------------------------------------------------------------------------

create or replace function public.fn_caja_cerrar(
  p_id_caja uuid,
  p_observaciones text,
  p_creado_por uuid
)
returns public.caja
language plpgsql
set search_path to 'public'
as $$
declare
  v_caja      public.caja;
  v_arqueo    public.arqueo_caja;
  v_ult_mov   timestamptz;
  v_resumen   jsonb;
begin
  select * into v_caja from public.caja where id_caja = p_id_caja for update;
  if v_caja.id_caja is null then
    raise exception 'La caja indicada no existe' using errcode = 'CAJ03';
  end if;
  if v_caja.estado <> 'Abierta' then
    raise exception 'La caja ya esta cerrada' using errcode = 'CAJ04';
  end if;

  select * into v_arqueo from public.arqueo_caja
  where id_caja = p_id_caja order by creado desc limit 1;
  if v_arqueo.id_arqueo is null then
    raise exception 'Antes de cerrar la caja tenes que realizar el arqueo' using errcode = 'CAJ12';
  end if;

  select max(creado) into v_ult_mov from public.movimiento_caja where id_caja = p_id_caja;
  if v_ult_mov is not null and v_ult_mov >= v_arqueo.creado then
    raise exception 'Hubo movimientos despues del ultimo arqueo. Realiza un nuevo arqueo antes de cerrar'
      using errcode = 'CAJ12';
  end if;

  v_resumen := public.fn_caja_resumen(p_id_caja);

  update public.caja
  set estado = 'Cerrada',
      fecha_cierre = now(),
      cerrada_por = coalesce(p_creado_por, auth.uid()),
      observaciones_cierre = nullif(btrim(p_observaciones), ''),
      id_arqueo_cierre = v_arqueo.id_arqueo,
      total_ingresos = (v_resumen->>'total_ingresos')::numeric,
      total_egresos = (v_resumen->>'total_egresos')::numeric,
      saldo_teorico_efectivo = v_arqueo.saldo_teorico,
      saldo_fisico_efectivo = v_arqueo.saldo_fisico,
      diferencia_efectivo = v_arqueo.diferencia,
      resumen_cierre = v_resumen
  where id_caja = p_id_caja
  returning * into v_caja;

  return v_caja;
end;
$$;

-- ---------------------------------------------------------------------------
-- V-21 · fn_venta_registrar con tipo de venta
-- ---------------------------------------------------------------------------
-- Mayorista: cliente mayorista, lista Mayorista, nace "En preparación" (se despacha y se cobra en Tesorería).
-- Minorista: cliente minorista registrado, lista Minorista, se cobra en la caja abierta.
-- Consumidor final: cliente opcional (genérico si no viene), lista Minorista, se cobra en caja.
-- p_medios (solo minorista / consumidor final): [{ id_medio_pago, importe, referencia? }].

drop function if exists public.fn_venta_registrar(uuid, uuid, date, text, jsonb, numeric, uuid);

create function public.fn_venta_registrar(
  p_id_cliente uuid,
  p_id_tipo_comprobante uuid,
  p_fecha_comprobante date,
  p_observaciones text,
  p_detalle jsonb,
  p_descuento_porcentaje numeric,
  p_creado_por uuid,
  p_tipo_venta public.tipo_venta default 'Mayorista',
  p_medios jsonb default null
) returns public.comprobante_venta
language plpgsql
set search_path to 'public'
as $function$
declare
  v_tipo_venta      public.tipo_venta := coalesce(p_tipo_venta, 'Mayorista');
  v_tipo_lista      public.tipo_lista_precio;
  v_id_cliente      uuid := p_id_cliente;
  v_venta           public.comprobante_venta;
  v_cliente         record;
  v_tipo            record;
  v_lista           public.lista_precio;
  v_invalidas       integer;
  v_sin_precio      text;
  v_pct             numeric := coalesce(p_descuento_porcentaje, 0);
  v_subtotal        numeric;
  v_descuento_total numeric;
  v_importe_total   numeric;
  v_numero          integer;
  v_id_tipo_mov     uuid;
  v_remito          text;
  v_movimiento      public.movimiento_stock;
  r                 record;
begin
  v_tipo_lista := case when v_tipo_venta = 'Mayorista' then 'Mayorista' else 'Minorista' end;

  if v_tipo_venta = 'Consumidor final' and v_id_cliente is null then
    select id_cliente into v_id_cliente
    from public.cliente
    where es_consumidor_final and activo
    order by creado
    limit 1;
    if v_id_cliente is null then
      raise exception 'No existe el cliente generico "Consumidor final" activo' using errcode = 'VTA01';
    end if;
  end if;

  select c.id_cliente, c.activo, c.es_consumidor_final, tc.lista_precio
    into v_cliente
  from public.cliente c
  join public.tipo_cliente tc on tc.id_tipo_cliente = c.id_tipo_cliente
  where c.id_cliente = v_id_cliente;

  if v_cliente.id_cliente is null then
    raise exception 'El cliente indicado no existe' using errcode = 'VTA01';
  end if;
  if v_cliente.activo = false then
    raise exception 'El cliente esta inactivo y no admite nuevas ventas' using errcode = 'VTA01';
  end if;

  if v_tipo_venta = 'Mayorista' and (v_cliente.es_consumidor_final or v_cliente.lista_precio <> 'Mayorista') then
    raise exception 'Solo se pueden registrar ventas mayoristas a clientes mayoristas' using errcode = 'VTA02';
  end if;
  if v_tipo_venta = 'Minorista' and (v_cliente.es_consumidor_final or v_cliente.lista_precio <> 'Minorista') then
    raise exception 'La venta minorista requiere un cliente minorista registrado' using errcode = 'VTA02';
  end if;
  if v_tipo_venta = 'Consumidor final' and v_cliente.lista_precio <> 'Minorista' then
    raise exception 'Una venta a consumidor final admite el cliente generico o un cliente minorista' using errcode = 'VTA02';
  end if;

  select id_tipo_comprobante, aplica_venta, clase, activo into v_tipo
  from public.tipo_comprobante where id_tipo_comprobante = p_id_tipo_comprobante;
  if v_tipo.id_tipo_comprobante is null then
    raise exception 'El tipo de comprobante indicado no existe' using errcode = 'VTA03';
  end if;
  if v_tipo.activo = false or v_tipo.aplica_venta = false or v_tipo.clase <> 'factura' then
    raise exception 'El tipo de comprobante seleccionado no es una factura de venta activa' using errcode = 'VTA03';
  end if;

  if p_fecha_comprobante is null then
    raise exception 'La fecha de la venta es obligatoria' using errcode = 'VTA04';
  end if;
  if p_fecha_comprobante > current_date then
    raise exception 'La fecha de la venta no puede ser futura' using errcode = 'VTA04';
  end if;

  if v_tipo_venta = 'Mayorista' then
    if p_medios is not null and jsonb_typeof(p_medios) = 'array' and jsonb_array_length(p_medios) > 0 then
      raise exception 'La venta mayorista se cobra en Tesoreria una vez despachada' using errcode = 'VTA15';
    end if;
  else
    if p_fecha_comprobante <> current_date then
      raise exception 'Las ventas que se cobran en caja se registran con la fecha del dia' using errcode = 'VTA04';
    end if;
    if not exists (select 1 from public.caja where punto_venta = 1 and estado = 'Abierta') then
      raise exception 'No hay una caja abierta. Abri la caja para registrar ventas minoristas o a consumidor final'
        using errcode = 'CAJ04';
    end if;
    if p_medios is null or jsonb_typeof(p_medios) <> 'array' or jsonb_array_length(p_medios) = 0 then
      raise exception 'La venta debe cobrarse con al menos un medio de pago' using errcode = 'CAJ09';
    end if;
  end if;

  if p_detalle is null or jsonb_typeof(p_detalle) <> 'array' or jsonb_array_length(p_detalle) = 0 then
    raise exception 'La venta debe tener al menos un articulo' using errcode = 'VTA05';
  end if;

  if v_pct < 0 or v_pct > 100 then
    raise exception 'El descuento debe estar entre 0 y 100 por ciento' using errcode = 'VTA05';
  end if;

  select count(*) into v_invalidas
  from jsonb_array_elements(p_detalle) as e(value)
  where nullif(e.value->>'id_producto', '') is null
     or nullif(e.value->>'id_deposito', '') is null
     or coalesce((e.value->>'cantidad')::numeric, 0) <= 0;
  if v_invalidas > 0 then
    raise exception 'Hay lineas invalidas: cada linea necesita articulo, deposito y cantidad mayor a cero' using errcode = 'VTA05';
  end if;

  for r in
    select distinct (e.value->>'id_producto')::uuid as id_producto
    from jsonb_array_elements(p_detalle) as e(value)
  loop
    if not exists (select 1 from public.producto where id_producto = r.id_producto and activo = true) then
      raise exception 'Uno de los articulos no existe o esta inhabilitado' using errcode = 'VTA06';
    end if;
  end loop;

  for r in
    select distinct (e.value->>'id_deposito')::uuid as id_deposito
    from jsonb_array_elements(p_detalle) as e(value)
  loop
    if not exists (select 1 from public.deposito where id_deposito = r.id_deposito and activo = true) then
      raise exception 'Uno de los depositos no existe o esta inhabilitado' using errcode = 'VTA07';
    end if;
  end loop;

  for r in
    select p.nombre_producto, d.nombre_deposito, t.cantidad, coalesce(s.cantidad, 0) as disponible
    from (
      select (e.value->>'id_producto')::uuid as id_producto,
             (e.value->>'id_deposito')::uuid as id_deposito,
             sum((e.value->>'cantidad')::numeric) as cantidad
      from jsonb_array_elements(p_detalle) as e(value)
      group by 1, 2
    ) t
    join public.producto p on p.id_producto = t.id_producto
    join public.deposito d on d.id_deposito = t.id_deposito
    left join public.stock s on s.id_producto = t.id_producto and s.id_deposito = t.id_deposito
  loop
    if r.disponible < r.cantidad then
      raise exception 'Stock insuficiente de "%" en %: disponible %, pedido %',
        r.nombre_producto, r.nombre_deposito, r.disponible, r.cantidad
        using errcode = 'VTA08';
    end if;
  end loop;

  select * into v_lista
  from public.fn_lista_precio_vigente(v_tipo_lista, p_fecha_comprobante)
  limit 1;
  if v_lista.id_lista_precio is null then
    raise exception 'No hay una lista de precios % vigente al %', v_tipo_lista, p_fecha_comprobante
      using errcode = 'VTA13';
  end if;

  select string_agg(distinct p.nombre_producto, ', ') into v_sin_precio
  from jsonb_array_elements(p_detalle) as e(value)
  join public.producto p on p.id_producto = (e.value->>'id_producto')::uuid
  left join public.lista_precio_detalle lpd
    on lpd.id_lista_precio = v_lista.id_lista_precio and lpd.id_producto = p.id_producto
  where lpd.precio is null;
  if v_sin_precio is not null then
    raise exception 'Sin precio en la lista "%" para: %', v_lista.nombre_lista_precio, v_sin_precio
      using errcode = 'VTA14';
  end if;

  select round(coalesce(sum((e.value->>'cantidad')::numeric * lpd.precio), 0), 2)
    into v_subtotal
  from jsonb_array_elements(p_detalle) as e(value)
  join public.lista_precio_detalle lpd
    on lpd.id_lista_precio = v_lista.id_lista_precio
   and lpd.id_producto = (e.value->>'id_producto')::uuid;

  v_descuento_total := round(v_subtotal * v_pct / 100, 2);
  v_importe_total := round(v_subtotal - v_descuento_total, 2);
  if v_importe_total <= 0 then
    raise exception 'El importe total de la venta debe ser mayor a cero' using errcode = 'VTA11';
  end if;

  perform pg_advisory_xact_lock(hashtext('comprobante_venta:' || p_id_tipo_comprobante::text || ':1'));

  select coalesce(max(numero), 0) + 1 into v_numero
  from public.comprobante_venta
  where id_tipo_comprobante = p_id_tipo_comprobante and punto_venta = 1;

  insert into public.comprobante_venta (
    id_cliente, id_tipo_comprobante, punto_venta, numero, fecha_comprobante,
    subtotal, descuento_total, importe_total, saldo_pendiente,
    id_lista_precio, descuento_porcentaje, tipo_venta,
    observaciones, estado, creado_por
  ) values (
    v_id_cliente, p_id_tipo_comprobante, 1, v_numero, p_fecha_comprobante,
    v_subtotal, v_descuento_total, v_importe_total, v_importe_total,
    v_lista.id_lista_precio, v_pct, v_tipo_venta,
    nullif(btrim(p_observaciones), ''), 'En preparación', coalesce(p_creado_por, auth.uid())
  )
  returning * into v_venta;

  insert into public.comprobante_venta_detalle (
    id_comprobante, nro_linea, id_producto, id_deposito, cantidad, precio_unitario, descuento
  )
  select
    v_venta.id_comprobante,
    e.ord::integer,
    (e.value->>'id_producto')::uuid,
    (e.value->>'id_deposito')::uuid,
    (e.value->>'cantidad')::numeric,
    lpd.precio,
    0
  from jsonb_array_elements(p_detalle) with ordinality as e(value, ord)
  join public.lista_precio_detalle lpd
    on lpd.id_lista_precio = v_lista.id_lista_precio
   and lpd.id_producto = (e.value->>'id_producto')::uuid;

  select id_tipo_movimiento into v_id_tipo_mov
  from public.tipo_movimiento
  where lower(btrim(nombre)) = 'salida por venta' and activo = true;
  if v_id_tipo_mov is null then
    raise exception 'No existe el tipo de movimiento "Salida por venta" activo' using errcode = 'VTA12';
  end if;

  v_remito := 'Venta ' || lpad(v_venta.punto_venta::text, 5, '0') || '-' || lpad(v_venta.numero::text, 8, '0');

  for r in
    select id_detalle, id_producto, id_deposito, cantidad
    from public.comprobante_venta_detalle
    where id_comprobante = v_venta.id_comprobante
    order by nro_linea
  loop
    v_movimiento := public.fn_movimiento_stock_registrar(
      v_id_tipo_mov, r.id_producto, r.id_deposito, r.cantidad,
      coalesce(p_creado_por, auth.uid()), p_fecha_comprobante, v_remito, null
    );

    update public.comprobante_venta_detalle
    set id_movimiento = v_movimiento.id_movimiento
    where id_detalle = r.id_detalle;
  end loop;

  if v_tipo_venta <> 'Mayorista' then
    perform public.fn_caja_registrar_cobro_venta(v_venta.id_comprobante, p_medios, coalesce(p_creado_por, auth.uid()));
    select * into v_venta from public.comprobante_venta where id_comprobante = v_venta.id_comprobante;
  end if;

  return v_venta;
end;
$function$;

-- ---------------------------------------------------------------------------
-- V-19 · Listado y detalle con tipo de venta y cobro en caja
-- ---------------------------------------------------------------------------

drop function if exists public.fn_venta_listar(uuid, date, date, public.estado_venta);

create function public.fn_venta_listar(
  p_id_cliente uuid default null,
  p_desde date default null,
  p_hasta date default null,
  p_estado public.estado_venta default null,
  p_tipo_venta public.tipo_venta default null
)
returns table (
  id_comprobante uuid,
  id_cliente uuid,
  nombre_cliente text,
  id_tipo_comprobante uuid,
  nombre_tipo_comprobante text,
  letra character,
  punto_venta integer,
  numero integer,
  numero_formateado text,
  fecha_comprobante date,
  tipo_venta public.tipo_venta,
  importe_total numeric,
  saldo_pendiente numeric,
  estado public.estado_venta,
  cantidad_articulos bigint,
  id_cobro uuid,
  id_caja uuid,
  creado timestamptz,
  creado_por uuid,
  creado_por_nombre text
)
language sql
stable
set search_path to 'public'
as $$
  select
    v.id_comprobante,
    v.id_cliente,
    c.nombre_cliente,
    v.id_tipo_comprobante,
    tc.nombre_tipo_comprobante,
    tc.letra,
    v.punto_venta,
    v.numero,
    lpad(v.punto_venta::text, 5, '0') || '-' || lpad(v.numero::text, 8, '0') as numero_formateado,
    v.fecha_comprobante,
    v.tipo_venta,
    v.importe_total,
    v.saldo_pendiente,
    v.estado,
    (select count(*) from public.comprobante_venta_detalle d where d.id_comprobante = v.id_comprobante) as cantidad_articulos,
    cb.id_cobro,
    v.id_caja,
    v.creado,
    v.creado_por,
    coalesce(u.nombre_completo, 'Usuario no disponible') as creado_por_nombre
  from public.comprobante_venta v
  join public.cliente c on c.id_cliente = v.id_cliente
  join public.tipo_comprobante tc on tc.id_tipo_comprobante = v.id_tipo_comprobante
  left join public.cobro cb on cb.id_comprobante = v.id_comprobante
  left join public.vw_usuario_resumen u on u.id_usuario = v.creado_por
  where (p_id_cliente is null or v.id_cliente = p_id_cliente)
    and (p_desde is null or v.fecha_comprobante >= p_desde)
    and (p_hasta is null or v.fecha_comprobante <= p_hasta)
    and (p_estado is null or v.estado = p_estado)
    and (p_tipo_venta is null or v.tipo_venta = p_tipo_venta)
  order by v.fecha_comprobante desc, v.creado desc;
$$;

create or replace function public.fn_venta_obtener(p_id_comprobante uuid)
returns jsonb
language sql
stable
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'venta', jsonb_build_object(
      'id_comprobante', v.id_comprobante,
      'id_cliente', v.id_cliente,
      'nombre_cliente', c.nombre_cliente,
      'documento_cliente', c.documento_cliente,
      'telefono_cliente', c.telefono_cliente,
      'direccion_cliente', c.direccion_cliente,
      'nombre_tipo_cliente', tcl.nombre_tipo_cliente,
      'id_tipo_comprobante', v.id_tipo_comprobante,
      'nombre_tipo_comprobante', tc.nombre_tipo_comprobante,
      'letra', tc.letra,
      'punto_venta', v.punto_venta,
      'numero', v.numero,
      'numero_formateado', lpad(v.punto_venta::text, 5, '0') || '-' || lpad(v.numero::text, 8, '0'),
      'fecha_comprobante', v.fecha_comprobante,
      'canal', v.canal,
      'tipo_venta', v.tipo_venta,
      'id_caja', v.id_caja,
      'subtotal', v.subtotal,
      'descuento_total', v.descuento_total,
      'descuento_porcentaje', v.descuento_porcentaje,
      'id_lista_precio', v.id_lista_precio,
      'nombre_lista_precio', lp.nombre_lista_precio,
      'importe_total', v.importe_total,
      'saldo_pendiente', v.saldo_pendiente,
      'observaciones', v.observaciones,
      'estado', v.estado,
      'fecha_despacho', v.fecha_despacho,
      'creado', v.creado,
      'creado_por', v.creado_por,
      'creado_por_nombre', coalesce(u.nombre_completo, 'Usuario no disponible')
    ),
    'detalle', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id_detalle', d.id_detalle,
        'nro_linea', d.nro_linea,
        'id_producto', d.id_producto,
        'codigo_producto', p.codigo_producto,
        'nombre_completo', p.nombre_producto || ' - ' || m.nombre_marca || ' (' || p.numero_medida || ' ' || um.abreviatura || ')',
        'id_deposito', d.id_deposito,
        'nombre_deposito', dep.nombre_deposito,
        'cantidad', d.cantidad,
        'precio_unitario', d.precio_unitario,
        'descuento', d.descuento,
        'importe_linea', d.importe_linea,
        'id_movimiento', d.id_movimiento
      ) order by d.nro_linea)
      from public.comprobante_venta_detalle d
      join public.producto p on p.id_producto = d.id_producto
      join public.marca m on m.id_marca = p.id_marca
      join public.unidad_medida um on um.id_unidad_medida = p.id_unidad_medida
      join public.deposito dep on dep.id_deposito = d.id_deposito
      where d.id_comprobante = v.id_comprobante
    ), '[]'::jsonb),
    'cobro', (
      select jsonb_build_object(
        'id_cobro', cb.id_cobro,
        'fecha_cobro', cb.fecha_cobro,
        'importe_total', cb.importe_total,
        'creado_por_nombre', coalesce(uc.nombre_completo, 'Usuario no disponible'),
        'medios', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', cm.id,
            'nombre_medio_pago', mp.nombre_medio_pago,
            'nombre_cuenta', ct.nombre_cuenta,
            'referencia', cm.referencia,
            'importe', cm.importe
          ) order by mp.nombre_medio_pago)
          from public.cobro_medio cm
          join public.medio_pago mp on mp.id_medio_pago = cm.id_medio_pago
          join public.cuenta_tesoreria ct on ct.id_cuenta = cm.id_cuenta_tesoreria
          where cm.id_cobro = cb.id_cobro
        ), '[]'::jsonb)
      )
      from public.cobro cb
      left join public.vw_usuario_resumen uc on uc.id_usuario = cb.creado_por
      where cb.id_comprobante = v.id_comprobante
    ),
    'cobro_caja', (
      select jsonb_agg(jsonb_build_object(
        'id_movimiento_caja', mc.id_movimiento_caja,
        'nombre_medio_pago', mp.nombre_medio_pago,
        'tipo_medio', mp.tipo,
        'importe', mc.importe,
        'referencia', mc.referencia,
        'creado', mc.creado,
        'creado_por_nombre', coalesce(umc.nombre_completo, 'Usuario no disponible')
      ) order by mc.creado)
      from public.movimiento_caja mc
      join public.medio_pago mp on mp.id_medio_pago = mc.id_medio_pago
      left join public.vw_usuario_resumen umc on umc.id_usuario = mc.creado_por
      where mc.id_comprobante = v.id_comprobante
    )
  )
  from public.comprobante_venta v
  join public.cliente c on c.id_cliente = v.id_cliente
  join public.tipo_cliente tcl on tcl.id_tipo_cliente = c.id_tipo_cliente
  join public.tipo_comprobante tc on tc.id_tipo_comprobante = v.id_tipo_comprobante
  left join public.lista_precio lp on lp.id_lista_precio = v.id_lista_precio
  left join public.vw_usuario_resumen u on u.id_usuario = v.creado_por
  where v.id_comprobante = p_id_comprobante;
$function$;

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------

revoke execute on function public._fn_caja_medio_validar(uuid, text) from public, anon;
revoke execute on function public.fn_caja_resumen(uuid) from public, anon;
revoke execute on function public.fn_caja_abrir(numeric, text, uuid, integer) from public, anon;
revoke execute on function public.fn_caja_obtener(uuid) from public, anon;
revoke execute on function public.fn_caja_obtener_abierta(integer) from public, anon;
revoke execute on function public.fn_caja_listar(date, date, public.estado_caja) from public, anon;
revoke execute on function public.fn_caja_movimiento_registrar(uuid, public.tipo_movimiento_tesoreria, uuid, numeric, text, text, uuid) from public, anon;
revoke execute on function public.fn_caja_registrar_cobro_venta(uuid, jsonb, uuid) from public, anon;
revoke execute on function public.fn_caja_arqueo_realizar(uuid, numeric, text, uuid) from public, anon;
revoke execute on function public.fn_caja_cerrar(uuid, text, uuid) from public, anon;
revoke execute on function public.fn_venta_registrar(uuid, uuid, date, text, jsonb, numeric, uuid, public.tipo_venta, jsonb) from public, anon;
revoke execute on function public.fn_venta_listar(uuid, date, date, public.estado_venta, public.tipo_venta) from public, anon;

grant execute on function public._fn_caja_medio_validar(uuid, text) to authenticated, service_role;
grant execute on function public.fn_caja_resumen(uuid) to authenticated, service_role;
grant execute on function public.fn_caja_abrir(numeric, text, uuid, integer) to authenticated, service_role;
grant execute on function public.fn_caja_obtener(uuid) to authenticated, service_role;
grant execute on function public.fn_caja_obtener_abierta(integer) to authenticated, service_role;
grant execute on function public.fn_caja_listar(date, date, public.estado_caja) to authenticated, service_role;
grant execute on function public.fn_caja_movimiento_registrar(uuid, public.tipo_movimiento_tesoreria, uuid, numeric, text, text, uuid) to authenticated, service_role;
grant execute on function public.fn_caja_registrar_cobro_venta(uuid, jsonb, uuid) to authenticated, service_role;
grant execute on function public.fn_caja_arqueo_realizar(uuid, numeric, text, uuid) to authenticated, service_role;
grant execute on function public.fn_caja_cerrar(uuid, text, uuid) to authenticated, service_role;
grant execute on function public.fn_venta_registrar(uuid, uuid, date, text, jsonb, numeric, uuid, public.tipo_venta, jsonb) to authenticated, service_role;
grant execute on function public.fn_venta_listar(uuid, date, date, public.estado_venta, public.tipo_venta) to authenticated, service_role;
