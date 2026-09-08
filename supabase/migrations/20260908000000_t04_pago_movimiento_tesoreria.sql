-- =====================================================================
-- T-08 | T-04 Pagos, aplicacion y movimientos de tesoreria (P2)
-- Sprint 2 - ERP El Palacio de las Golosinas
--
-- Depende de: T-07 (orden_pago), T-01 (cuenta_tesoreria),
--             T-02 (medio_pago.tipo + medio_pago_cuenta), T-C1.
--
-- Cierra el circuito: al registrar un pago desde una orden se crea el
-- pago, se generan los movimientos de tesoreria (bajando el saldo de las
-- cuentas), se aplica el importe a los comprobantes (bajando su
-- saldo_pendiente) y se recalculan los estados de la orden y de los
-- comprobantes.
--
-- Modelo (D-014):
--   - pago                cabecera (una orden puede tener varios pagos).
--   - pago_medio          medios efectivamente usados (cada uno con cuenta).
--   - pago_comprobante    aplicacion N:M independiente (cuanto de este pago
--                         cancela cada comprobante).
--   - movimiento_tesoreria  INMUTABLE. Mantiene cuenta_tesoreria.saldo_actual.
--
-- Funciones:
--   - fn_pago_registrar  [NUEVA] transaccional, p_confirmar_diferencia.
--   - fn_pago_listar     [NUEVA] listado enriquecido.
--   - fn_pago_obtener    [NUEVA] cabecera + medios + aplicaciones + movimientos (jsonb).
--
-- Codigos de error (PAG* - SQLSTATE de 5 chars):
--   PAG01  orden inexistente / no pagable por estado
--   PAG02  aplicacion invalida: comprobante ajeno a la orden / repetido /
--          anulado / importe <= 0 o mayor al saldo del comprobante / lista vacia
--   PAG03  suma de medios != suma aplicada / medio con importe <= 0 / sin medios
--   PAG04  cuenta no habilitada para el medio (medio_pago_cuenta) o medio/cuenta inactivos
--   PAG05  el total del pago difiere del de la orden y no se confirmo la diferencia
--
-- Patron: SECURITY INVOKER, RLS propia authenticated por tabla (D-010).
-- movimiento_tesoreria es inmutable: solo politicas SELECT + INSERT.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Enum de tipo de movimiento de tesoreria
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'tipo_movimiento_tesoreria') then
    create type public.tipo_movimiento_tesoreria as enum ('Ingreso', 'Egreso');
  end if;
end $$;


-- ---------------------------------------------------------------------
-- Cabecera del pago
-- ---------------------------------------------------------------------
create table if not exists public.pago (
  id_pago       uuid primary key default gen_random_uuid(),

  id_orden_pago uuid not null references public.orden_pago (id_orden_pago),
  id_proveedor  uuid not null references public.proveedor (id_proveedor),

  fecha_pago    date not null,
  importe_total numeric(16,2) not null check (importe_total > 0),
  observaciones text,

  creado     timestamptz not null default now(),
  editado    timestamptz not null default now(),
  creado_por uuid not null default auth.uid()
);

comment on table public.pago is
  'T-08 | Pago registrado desde una orden de pago (D-014). importe_total = suma aplicada a comprobantes. Genera movimiento_tesoreria y baja saldos.';

create index if not exists idx_pago_orden on public.pago (id_orden_pago);
create index if not exists idx_pago_proveedor on public.pago (id_proveedor);


-- ---------------------------------------------------------------------
-- Medios efectivamente usados en el pago (cada uno con su cuenta)
-- ---------------------------------------------------------------------
create table if not exists public.pago_medio (
  id                  uuid primary key default gen_random_uuid(),

  id_pago             uuid not null
    references public.pago (id_pago) on delete cascade,
  id_medio_pago       uuid not null references public.medio_pago (id_medio_pago),
  id_cuenta_tesoreria uuid not null references public.cuenta_tesoreria (id_cuenta),

  importe    numeric(16,2) not null check (importe > 0),
  referencia text
);

comment on table public.pago_medio is
  'T-08 | Medios con los que se pago. La cuenta debe estar habilitada para el medio (medio_pago_cuenta).';

create index if not exists idx_pago_medio_pago on public.pago_medio (id_pago);


-- ---------------------------------------------------------------------
-- Aplicacion N:M pago <-> comprobante (independiente de la imputacion
-- de la orden: trazabilidad de como se cancelo cada deuda)
-- ---------------------------------------------------------------------
create table if not exists public.pago_comprobante (
  id              uuid primary key default gen_random_uuid(),

  id_pago         uuid not null
    references public.pago (id_pago) on delete cascade,
  id_comprobante  uuid not null
    references public.comprobante_proveedor (id_comprobante),

  importe_aplicado numeric(16,2) not null check (importe_aplicado > 0),

  constraint pago_comprobante_uq unique (id_pago, id_comprobante)
);

comment on table public.pago_comprobante is
  'T-08 | Cuanto de este pago cancela cada comprobante. Baja comprobante_proveedor.saldo_pendiente.';

create index if not exists idx_pago_comprobante_pago on public.pago_comprobante (id_pago);
create index if not exists idx_pago_comprobante_comprobante on public.pago_comprobante (id_comprobante);


-- ---------------------------------------------------------------------
-- Movimiento de tesoreria - INMUTABLE (analogo a D-003)
--   Mantiene cuenta_tesoreria.saldo_actual. Sin fn_* de modificar ni
--   eliminar; RLS solo SELECT + INSERT.
-- ---------------------------------------------------------------------
create table if not exists public.movimiento_tesoreria (
  id_movimiento       uuid primary key default gen_random_uuid(),

  id_cuenta_tesoreria uuid not null references public.cuenta_tesoreria (id_cuenta),
  tipo                public.tipo_movimiento_tesoreria not null,
  importe             numeric(16,2) not null check (importe > 0),
  fecha               date not null,
  referencia          text,
  descripcion         text,

  id_pago             uuid references public.pago (id_pago),

  saldo_anterior      numeric(16,2) not null,
  saldo_nuevo         numeric(16,2) not null,

  creado     timestamptz not null default now(),
  creado_por uuid not null default auth.uid()
);

comment on table public.movimiento_tesoreria is
  'T-08 | Movimiento inmutable de una cuenta de tesoreria. Mantiene cuenta_tesoreria.saldo_actual. Origen opcional: id_pago.';

create index if not exists idx_movimiento_tesoreria_cuenta
  on public.movimiento_tesoreria (id_cuenta_tesoreria);
create index if not exists idx_movimiento_tesoreria_pago
  on public.movimiento_tesoreria (id_pago);


-- ---------------------------------------------------------------------
-- Trigger de auditoria (solo cabecera pago)
-- ---------------------------------------------------------------------
create or replace function public.set_editado_pago()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.editado    := now();
  new.creado     := old.creado;
  new.creado_por := old.creado_por;
  return new;
end;
$$;

drop trigger if exists trg_set_editado_pago on public.pago;
create trigger trg_set_editado_pago
  before update on public.pago
  for each row execute function public.set_editado_pago();


-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.pago enable row level security;
alter table public.pago_medio enable row level security;
alter table public.pago_comprobante enable row level security;
alter table public.movimiento_tesoreria enable row level security;

-- pago - 4 politicas authenticated
drop policy if exists "pago_select_authenticated" on public.pago;
drop policy if exists "pago_insert_authenticated" on public.pago;
drop policy if exists "pago_update_authenticated" on public.pago;
drop policy if exists "pago_delete_authenticated" on public.pago;
create policy "pago_select_authenticated"
  on public.pago for select to authenticated using (true);
create policy "pago_insert_authenticated"
  on public.pago for insert to authenticated with check (true);
create policy "pago_update_authenticated"
  on public.pago for update to authenticated using (true) with check (true);
create policy "pago_delete_authenticated"
  on public.pago for delete to authenticated using (true);

-- pago_medio - 4 politicas authenticated
drop policy if exists "pago_medio_select_authenticated" on public.pago_medio;
drop policy if exists "pago_medio_insert_authenticated" on public.pago_medio;
drop policy if exists "pago_medio_update_authenticated" on public.pago_medio;
drop policy if exists "pago_medio_delete_authenticated" on public.pago_medio;
create policy "pago_medio_select_authenticated"
  on public.pago_medio for select to authenticated using (true);
create policy "pago_medio_insert_authenticated"
  on public.pago_medio for insert to authenticated with check (true);
create policy "pago_medio_update_authenticated"
  on public.pago_medio for update to authenticated using (true) with check (true);
create policy "pago_medio_delete_authenticated"
  on public.pago_medio for delete to authenticated using (true);

-- pago_comprobante - 4 politicas authenticated
drop policy if exists "pago_comprobante_select_authenticated" on public.pago_comprobante;
drop policy if exists "pago_comprobante_insert_authenticated" on public.pago_comprobante;
drop policy if exists "pago_comprobante_update_authenticated" on public.pago_comprobante;
drop policy if exists "pago_comprobante_delete_authenticated" on public.pago_comprobante;
create policy "pago_comprobante_select_authenticated"
  on public.pago_comprobante for select to authenticated using (true);
create policy "pago_comprobante_insert_authenticated"
  on public.pago_comprobante for insert to authenticated with check (true);
create policy "pago_comprobante_update_authenticated"
  on public.pago_comprobante for update to authenticated using (true) with check (true);
create policy "pago_comprobante_delete_authenticated"
  on public.pago_comprobante for delete to authenticated using (true);

-- movimiento_tesoreria - INMUTABLE: solo SELECT + INSERT
drop policy if exists "movimiento_tesoreria_select_authenticated" on public.movimiento_tesoreria;
drop policy if exists "movimiento_tesoreria_insert_authenticated" on public.movimiento_tesoreria;
create policy "movimiento_tesoreria_select_authenticated"
  on public.movimiento_tesoreria for select to authenticated using (true);
create policy "movimiento_tesoreria_insert_authenticated"
  on public.movimiento_tesoreria for insert to authenticated with check (true);


-- ---------------------------------------------------------------------
-- fn_pago_registrar - alta transaccional (NUEVA)
--   Hace, en orden:
--     1. valida orden en 'Pendiente de pago' / 'Pagada parcial';
--     2. valida aplicaciones (comprobantes de la orden, con saldo) y
--        medios (cuenta habilitada, activos), y sum(medios) = sum(aplicado);
--     3. si sum(aplicado) != orden.importe_total y no se confirma -> PAG05;
--     4. inserta pago + pago_medio + pago_comprobante;
--     5. por cada medio: movimiento_tesoreria 'Egreso' + baja saldo_actual;
--     6. por cada aplicacion: baja comprobante_proveedor.saldo_pendiente;
--     7. recalcula estado de la orden ('Pagada' / 'Pagada parcial');
--     8. recalcula estado de cada comprobante (fn_comprobante_recalcular_estado).
-- ---------------------------------------------------------------------
create or replace function public.fn_pago_registrar(
  p_id_orden_pago uuid,
  p_fecha_pago date,
  p_medios jsonb,
  p_aplicaciones jsonb,
  p_confirmar_diferencia boolean,
  p_creado_por uuid
)
returns public.pago
language plpgsql
set search_path to 'public'
as $function$
declare
  v_orden          public.orden_pago;
  v_pago           public.pago;
  v_comp           public.comprobante_proveedor;
  v_activo         boolean;
  v_suma_medios    numeric(16,2);
  v_suma_aplicada  numeric(16,2);
  v_prov_nombre    text;
  v_saldo_ant      numeric(16,2);
  v_falta          boolean;
  r                record;
begin
  -- 1. orden pagable
  select * into v_orden from public.orden_pago where id_orden_pago = p_id_orden_pago;
  if v_orden.id_orden_pago is null then
    raise exception 'La orden de pago indicada no existe' using errcode = 'PAG01';
  end if;
  if v_orden.estado not in ('Pendiente de pago', 'Pagada parcial') then
    raise exception 'La orden no admite pagos en estado %', lower(v_orden.estado::text)
      using errcode = 'PAG01';
  end if;

  if p_aplicaciones is null
     or jsonb_typeof(p_aplicaciones) <> 'array'
     or jsonb_array_length(p_aplicaciones) = 0 then
    raise exception 'El pago debe aplicar al menos un comprobante' using errcode = 'PAG02';
  end if;
  if p_medios is null
     or jsonb_typeof(p_medios) <> 'array'
     or jsonb_array_length(p_medios) = 0 then
    raise exception 'El pago debe tener al menos un medio de pago' using errcode = 'PAG03';
  end if;

  if (
    select count(distinct (e.value->>'id_comprobante'))
    from jsonb_array_elements(p_aplicaciones) as e(value)
  ) <> jsonb_array_length(p_aplicaciones) then
    raise exception 'Hay comprobantes repetidos en el pago' using errcode = 'PAG02';
  end if;

  -- 2a. aplicaciones
  for r in
    select (e.value->>'id_comprobante')::uuid as id_comprobante,
           (e.value->>'importe_aplicado')::numeric as importe_aplicado
    from jsonb_array_elements(p_aplicaciones) as e(value)
  loop
    if not exists (
      select 1 from public.orden_pago_comprobante
      where id_orden_pago = p_id_orden_pago and id_comprobante = r.id_comprobante
    ) then
      raise exception 'Un comprobante del pago no pertenece a la orden' using errcode = 'PAG02';
    end if;
    if r.importe_aplicado is null or r.importe_aplicado <= 0 then
      raise exception 'El importe aplicado a cada comprobante debe ser mayor a cero' using errcode = 'PAG02';
    end if;

    select * into v_comp
    from public.comprobante_proveedor where id_comprobante = r.id_comprobante;
    if v_comp.id_comprobante is null or v_comp.anulado then
      raise exception 'Un comprobante del pago no existe o esta anulado' using errcode = 'PAG02';
    end if;
    if round(r.importe_aplicado, 2) > round(v_comp.saldo_pendiente, 2) then
      raise exception 'No se puede aplicar % a un comprobante con saldo %',
        to_char(round(r.importe_aplicado, 2), 'FM999999999990.00'),
        to_char(round(v_comp.saldo_pendiente, 2), 'FM999999999990.00')
        using errcode = 'PAG02';
    end if;
  end loop;

  -- 2b. medios
  for r in
    select (e.value->>'id_medio_pago')::uuid as id_medio_pago,
           (e.value->>'id_cuenta_tesoreria')::uuid as id_cuenta_tesoreria,
           (e.value->>'importe')::numeric as importe
    from jsonb_array_elements(p_medios) as e(value)
  loop
    if r.importe is null or r.importe <= 0 then
      raise exception 'El importe de cada medio de pago debe ser mayor a cero' using errcode = 'PAG03';
    end if;

    select activo into v_activo from public.medio_pago where id_medio_pago = r.id_medio_pago;
    if v_activo is null then
      raise exception 'Uno de los medios de pago no existe' using errcode = 'PAG04';
    end if;
    if v_activo = false then
      raise exception 'Uno de los medios de pago esta inactivo' using errcode = 'PAG04';
    end if;

    select activo into v_activo from public.cuenta_tesoreria where id_cuenta = r.id_cuenta_tesoreria;
    if v_activo is null then
      raise exception 'Una de las cuentas de tesoreria no existe' using errcode = 'PAG04';
    end if;
    if v_activo = false then
      raise exception 'Una de las cuentas de tesoreria esta inactiva' using errcode = 'PAG04';
    end if;

    if not exists (
      select 1 from public.medio_pago_cuenta
      where id_medio_pago = r.id_medio_pago
        and id_cuenta_tesoreria = r.id_cuenta_tesoreria
    ) then
      raise exception 'La cuenta elegida no esta habilitada para ese medio de pago' using errcode = 'PAG04';
    end if;
  end loop;

  select coalesce(sum((e.value->>'importe')::numeric), 0) into v_suma_medios
  from jsonb_array_elements(p_medios) as e(value);
  select coalesce(sum((e.value->>'importe_aplicado')::numeric), 0) into v_suma_aplicada
  from jsonb_array_elements(p_aplicaciones) as e(value);

  if round(v_suma_medios, 2) <> round(v_suma_aplicada, 2) then
    raise exception 'La suma de los medios (%) no coincide con lo aplicado (%)',
      to_char(round(v_suma_medios, 2), 'FM999999999990.00'),
      to_char(round(v_suma_aplicada, 2), 'FM999999999990.00')
      using errcode = 'PAG03';
  end if;

  -- 3. diferencia vs orden
  if round(v_suma_aplicada, 2) <> round(v_orden.importe_total, 2)
     and coalesce(p_confirmar_diferencia, false) = false then
    raise exception 'El total del pago (%) no coincide con el de la orden (%). Confirma la diferencia para continuar.',
      to_char(round(v_suma_aplicada, 2), 'FM999999999990.00'),
      to_char(round(v_orden.importe_total, 2), 'FM999999999990.00')
      using errcode = 'PAG05';
  end if;

  select nombre_proveedor into v_prov_nombre
  from public.proveedor where id_proveedor = v_orden.id_proveedor;

  -- 4. pago + detalle
  insert into public.pago (
    id_orden_pago, id_proveedor, fecha_pago, importe_total, creado_por
  ) values (
    p_id_orden_pago, v_orden.id_proveedor, coalesce(p_fecha_pago, current_date),
    round(v_suma_aplicada, 2), coalesce(p_creado_por, auth.uid())
  )
  returning * into v_pago;

  insert into public.pago_medio (id_pago, id_medio_pago, id_cuenta_tesoreria, importe, referencia)
  select v_pago.id_pago,
         (e.value->>'id_medio_pago')::uuid,
         (e.value->>'id_cuenta_tesoreria')::uuid,
         round((e.value->>'importe')::numeric, 2),
         nullif(btrim(e.value->>'referencia'), '')
  from jsonb_array_elements(p_medios) as e(value);

  insert into public.pago_comprobante (id_pago, id_comprobante, importe_aplicado)
  select v_pago.id_pago,
         (e.value->>'id_comprobante')::uuid,
         round((e.value->>'importe_aplicado')::numeric, 2)
  from jsonb_array_elements(p_aplicaciones) as e(value);

  -- 5. movimientos de tesoreria + saldo de cuentas
  for r in
    select pm.id_cuenta_tesoreria, pm.importe, pm.referencia
    from public.pago_medio pm
    where pm.id_pago = v_pago.id_pago
  loop
    select saldo_actual into v_saldo_ant
    from public.cuenta_tesoreria where id_cuenta = r.id_cuenta_tesoreria
    for update;

    insert into public.movimiento_tesoreria (
      id_cuenta_tesoreria, tipo, importe, fecha, referencia, descripcion,
      id_pago, saldo_anterior, saldo_nuevo, creado_por
    ) values (
      r.id_cuenta_tesoreria, 'Egreso', round(r.importe, 2), v_pago.fecha_pago,
      r.referencia, 'Pago a ' || coalesce(v_prov_nombre, 'proveedor'),
      v_pago.id_pago, round(v_saldo_ant, 2), round(v_saldo_ant - r.importe, 2),
      coalesce(p_creado_por, auth.uid())
    );

    update public.cuenta_tesoreria
    set saldo_actual = round(saldo_actual - r.importe, 2)
    where id_cuenta = r.id_cuenta_tesoreria;
  end loop;

  -- 6. baja de saldo de los comprobantes
  for r in
    select id_comprobante, importe_aplicado
    from public.pago_comprobante where id_pago = v_pago.id_pago
  loop
    update public.comprobante_proveedor
    set saldo_pendiente = round(saldo_pendiente - r.importe_aplicado, 2)
    where id_comprobante = r.id_comprobante;
  end loop;

  -- 7. estado de la orden: 'Pagada' si toda imputacion quedo cubierta por
  --    aplicaciones (acumulado sobre todos los pagos de la orden), si no
  --    'Pagada parcial'.
  select bool_or(cubierto = false) into v_falta
  from (
    select coalesce((
             select sum(pc.importe_aplicado)
             from public.pago_comprobante pc
             join public.pago pg on pg.id_pago = pc.id_pago
             where pg.id_orden_pago = p_id_orden_pago
               and pc.id_comprobante = opc.id_comprobante
           ), 0) >= round(opc.importe_imputado, 2) as cubierto
    from public.orden_pago_comprobante opc
    where opc.id_orden_pago = p_id_orden_pago
  ) t;

  update public.orden_pago
  set estado = case when coalesce(v_falta, true) then 'Pagada parcial' else 'Pagada' end
    ::public.estado_orden_pago
  where id_orden_pago = p_id_orden_pago;

  -- 8. estado de cada comprobante (despues de fijar el de la orden)
  for r in
    select id_comprobante from public.pago_comprobante where id_pago = v_pago.id_pago
  loop
    perform public.fn_comprobante_recalcular_estado(r.id_comprobante);
  end loop;

  select * into v_pago from public.pago where id_pago = v_pago.id_pago;
  return v_pago;
end;
$function$;

comment on function public.fn_pago_registrar(uuid, date, jsonb, jsonb, boolean, uuid) is
  'T-08 | Registra un pago desde una orden: crea pago + medios + aplicaciones, genera movimiento_tesoreria (Egreso) bajando saldo_actual, baja saldo_pendiente de los comprobantes y recalcula estados de orden y comprobantes. Errcode PAG01..PAG05.';


-- ---------------------------------------------------------------------
-- fn_pago_listar - listado enriquecido (NUEVA)
-- ---------------------------------------------------------------------
create or replace function public.fn_pago_listar(
  p_id_proveedor uuid default null,
  p_desde date default null,
  p_hasta date default null
)
returns table (
  id_pago uuid,
  id_orden_pago uuid,
  id_proveedor uuid,
  nombre_proveedor text,
  fecha_pago date,
  importe_total numeric,
  cantidad_comprobantes bigint,
  creado timestamptz,
  creado_por uuid,
  creado_por_nombre text
)
language sql
stable
set search_path to 'public'
as $function$
  select
    pg.id_pago,
    pg.id_orden_pago,
    pg.id_proveedor,
    p.nombre_proveedor,
    pg.fecha_pago,
    pg.importe_total,
    (select count(*) from public.pago_comprobante pc where pc.id_pago = pg.id_pago) as cantidad_comprobantes,
    pg.creado,
    pg.creado_por,
    coalesce(ur.nombre_completo, 'Usuario no disponible') as creado_por_nombre
  from public.pago pg
  join public.proveedor p on p.id_proveedor = pg.id_proveedor
  left join public.vw_usuario_resumen ur on ur.id_usuario = pg.creado_por
  where (p_id_proveedor is null or pg.id_proveedor = p_id_proveedor)
    and (p_desde is null or pg.fecha_pago >= p_desde)
    and (p_hasta is null or pg.fecha_pago <= p_hasta)
  order by pg.fecha_pago desc, pg.creado desc;
$function$;

comment on function public.fn_pago_listar(uuid, date, date) is
  'T-08 | Listado de pagos con nombre del proveedor, cantidad de comprobantes aplicados y creado_por_nombre. Filtros opcionales por proveedor y rango de fecha_pago.';


-- ---------------------------------------------------------------------
-- fn_pago_obtener - cabecera + medios + aplicaciones + movimientos (NUEVA, jsonb)
-- ---------------------------------------------------------------------
create or replace function public.fn_pago_obtener(p_id_pago uuid)
returns jsonb
language sql
stable
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'pago', jsonb_build_object(
      'id_pago', pg.id_pago,
      'id_orden_pago', pg.id_orden_pago,
      'id_proveedor', pg.id_proveedor,
      'nombre_proveedor', p.nombre_proveedor,
      'fecha_pago', pg.fecha_pago,
      'importe_total', pg.importe_total,
      'observaciones', pg.observaciones,
      'estado_orden', o.estado,
      'creado', pg.creado,
      'editado', pg.editado,
      'creado_por', pg.creado_por,
      'creado_por_nombre', coalesce(ur.nombre_completo, 'Usuario no disponible')
    ),
    'medios', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pm.id,
        'id_medio_pago', pm.id_medio_pago,
        'nombre_medio_pago', mp.nombre_medio_pago,
        'tipo_medio_pago', mp.tipo,
        'id_cuenta_tesoreria', pm.id_cuenta_tesoreria,
        'nombre_cuenta', ct.nombre_cuenta,
        'tipo_cuenta', ct.tipo,
        'importe', pm.importe,
        'referencia', pm.referencia
      ) order by mp.nombre_medio_pago)
      from public.pago_medio pm
      join public.medio_pago mp on mp.id_medio_pago = pm.id_medio_pago
      join public.cuenta_tesoreria ct on ct.id_cuenta = pm.id_cuenta_tesoreria
      where pm.id_pago = pg.id_pago
    ), '[]'::jsonb),
    'aplicaciones', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pc.id,
        'id_comprobante', pc.id_comprobante,
        'numero_formateado',
          lpad(c.punto_venta::text, 5, '0') || '-' || lpad(c.numero::text, 8, '0'),
        'nombre_tipo_comprobante', tc.nombre_tipo_comprobante,
        'letra', tc.letra,
        'fecha_comprobante', c.fecha_comprobante,
        'fecha_vencimiento', c.fecha_vencimiento,
        'importe_total', c.importe_total,
        'saldo_pendiente', c.saldo_pendiente,
        'estado', c.estado,
        'importe_aplicado', pc.importe_aplicado
      ) order by c.fecha_comprobante, c.creado)
      from public.pago_comprobante pc
      join public.comprobante_proveedor c on c.id_comprobante = pc.id_comprobante
      join public.tipo_comprobante tc on tc.id_tipo_comprobante = c.id_tipo_comprobante
      where pc.id_pago = pg.id_pago
    ), '[]'::jsonb),
    'movimientos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id_movimiento', m.id_movimiento,
        'id_cuenta_tesoreria', m.id_cuenta_tesoreria,
        'nombre_cuenta', ct.nombre_cuenta,
        'tipo', m.tipo,
        'importe', m.importe,
        'fecha', m.fecha,
        'saldo_anterior', m.saldo_anterior,
        'saldo_nuevo', m.saldo_nuevo,
        'referencia', m.referencia,
        'descripcion', m.descripcion
      ) order by m.creado)
      from public.movimiento_tesoreria m
      join public.cuenta_tesoreria ct on ct.id_cuenta = m.id_cuenta_tesoreria
      where m.id_pago = pg.id_pago
    ), '[]'::jsonb)
  )
  from public.pago pg
  join public.proveedor p on p.id_proveedor = pg.id_proveedor
  join public.orden_pago o on o.id_orden_pago = pg.id_orden_pago
  left join public.vw_usuario_resumen ur on ur.id_usuario = pg.creado_por
  where pg.id_pago = p_id_pago;
$function$;

comment on function public.fn_pago_obtener(uuid) is
  'T-08 | Pago completo como jsonb: { pago, medios[], aplicaciones[], movimientos[] }. Devuelve null si no existe.';


-- ---------------------------------------------------------------------
-- GRANTs explicitos a authenticated (consistencia con T-02 / T-07)
-- ---------------------------------------------------------------------
grant execute on function public.fn_pago_registrar(uuid, date, jsonb, jsonb, boolean, uuid) to authenticated;
grant execute on function public.fn_pago_listar(uuid, date, date) to authenticated;
grant execute on function public.fn_pago_obtener(uuid) to authenticated;
