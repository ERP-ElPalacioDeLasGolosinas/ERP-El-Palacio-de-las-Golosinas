-- =====================================================================
-- T-C1 | Estado del comprobante de proveedor (P0)
-- Sprint 2 - ERP El Palacio de las Golosinas
--
-- Estado: aplicada en Supabase el 2026-09-07 (migracion 20260907190000).
--
-- El comprobante gana estado propio (enum estado_comprobante_proveedor),
-- mantenido por las fn_* (D-013). Hasta ahora solo habia saldo_pendiente
-- + anulado.
--
--   - type estado_comprobante_proveedor:
--       Pendiente / En orden de pago / Pagado parcial / Pagado / Anulado
--   - comprobante_proveedor.estado  not null default 'Pendiente', con
--     backfill desde anulado y saldo_pendiente vs importe_total.
--   - fn_comprobante_registrar  -> setea 'Pendiente'.
--   - fn_comprobante_anular      -> setea 'Anulado'.
--   - fn_comprobante_recalcular_estado(p_id_comprobante)  [NUEVA]
--       punto unico que llamaran ordenes de pago y pagos (T-07/T-08).
--       Deriva Pendiente / Pagado parcial / Pagado desde saldo_pendiente;
--       no toca los comprobantes anulados. El estado 'En orden de pago'
--       lo administra T-07.
--   - fn_comprobante_listar  -> nuevo param p_estado + columna estado.
--   - fn_comprobante_obtener -> columna estado.
--
-- Patron: SECURITY INVOKER, sin GRANT explicito (igual que el resto de
-- fn_comprobante_*); el acceso a datos pasa por RLS authenticated (D-010).
-- =====================================================================


-- ---------------------------------------------------------------------
-- Enum + columna mantenida
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'estado_comprobante_proveedor') then
    create type public.estado_comprobante_proveedor as enum (
      'Pendiente',
      'En orden de pago',
      'Pagado parcial',
      'Pagado',
      'Anulado'
    );
  end if;
end
$$;

alter table public.comprobante_proveedor
  add column if not exists estado public.estado_comprobante_proveedor
  not null default 'Pendiente';

comment on column public.comprobante_proveedor.estado is
  'T-C1 | Estado mantenido por las fn_* (D-013): Pendiente / En orden de pago / Pagado parcial / Pagado / Anulado. No se deriva en lectura.';

-- Backfill del estado para los comprobantes existentes.
update public.comprobante_proveedor
set estado = case
  when anulado then 'Anulado'
  when saldo_pendiente <= 0 then 'Pagado'
  when saldo_pendiente < importe_total then 'Pagado parcial'
  else 'Pendiente'
end::public.estado_comprobante_proveedor;


-- ---------------------------------------------------------------------
-- fn_comprobante_recalcular_estado - punto unico de recalculo (NUEVA)
-- La invocaran ordenes de pago y pagos cada vez que toquen el saldo.
-- ---------------------------------------------------------------------
create or replace function public.fn_comprobante_recalcular_estado(p_id_comprobante uuid)
returns public.comprobante_proveedor
language plpgsql
set search_path to 'public'
as $function$
declare
  v_comprobante public.comprobante_proveedor;
begin
  select * into v_comprobante
  from public.comprobante_proveedor
  where id_comprobante = p_id_comprobante;

  if v_comprobante.id_comprobante is null then
    raise exception 'El comprobante indicado no existe' using errcode = 'CMP08';
  end if;

  -- Un comprobante anulado no cambia de estado por recalculo.
  if v_comprobante.anulado then
    return v_comprobante;
  end if;

  update public.comprobante_proveedor
  set estado = case
    when saldo_pendiente <= 0 then 'Pagado'
    when saldo_pendiente < importe_total then 'Pagado parcial'
    else 'Pendiente'
  end::public.estado_comprobante_proveedor
  where id_comprobante = p_id_comprobante
  returning * into v_comprobante;

  return v_comprobante;
end;
$function$;

comment on function public.fn_comprobante_recalcular_estado(uuid) is
  'T-C1 | Recalcula el estado del comprobante desde saldo_pendiente (Pendiente / Pagado parcial / Pagado). No toca los anulados. Punto unico que llaman ordenes de pago y pagos (T-07/T-08). El estado "En orden de pago" lo administra T-07.';


-- ---------------------------------------------------------------------
-- fn_comprobante_registrar - alta transaccional; el estado nace 'Pendiente'
-- Resto del cuerpo sin cambios respecto de S2-2b.
-- ---------------------------------------------------------------------
create or replace function public.fn_comprobante_registrar(
  p_id_proveedor uuid,
  p_id_tipo_comprobante uuid,
  p_punto_venta integer,
  p_numero integer,
  p_fecha_comprobante date,
  p_fecha_vencimiento date,
  p_importe_total numeric,
  p_id_compra uuid,
  p_observaciones text,
  p_detalle jsonb,
  p_confirmar_diferencia boolean,
  p_creado_por uuid
)
returns public.comprobante_proveedor
language plpgsql
set search_path to 'public'
as $function$
declare
  v_comprobante   public.comprobante_proveedor;
  v_prov_activo   boolean;
  v_tipo          record;
  v_total_detalle numeric;
  v_coincide      boolean;
  v_invalidas     integer;
begin
  select activo into v_prov_activo
  from public.proveedor where id_proveedor = p_id_proveedor;
  if v_prov_activo is null then
    raise exception 'El proveedor indicado no existe' using errcode = 'CMP01';
  end if;
  if v_prov_activo = false then
    raise exception 'El proveedor esta inactivo y no admite nuevos comprobantes' using errcode = 'CMP09';
  end if;

  select id_tipo_comprobante, aplica_compra
    into v_tipo
  from public.tipo_comprobante where id_tipo_comprobante = p_id_tipo_comprobante;
  if v_tipo.id_tipo_comprobante is null then
    raise exception 'El tipo de comprobante indicado no existe' using errcode = 'CMP02';
  end if;
  if v_tipo.aplica_compra = false then
    raise exception 'El tipo de comprobante seleccionado no aplica a compras' using errcode = 'CMP02';
  end if;

  if p_punto_venta is null or p_punto_venta <= 0 or p_numero is null or p_numero <= 0 then
    raise exception 'El punto de venta y el numero deben ser mayores a cero' using errcode = 'CMP03';
  end if;

  if p_importe_total is null or p_importe_total <= 0 then
    raise exception 'El importe total debe ser mayor a cero' using errcode = 'CMP05';
  end if;

  if p_fecha_comprobante is null then
    raise exception 'La fecha del comprobante es obligatoria' using errcode = 'CMP06';
  end if;
  if p_fecha_vencimiento is not null and p_fecha_vencimiento < p_fecha_comprobante then
    raise exception 'El vencimiento no puede ser anterior a la fecha del comprobante' using errcode = 'CMP06';
  end if;

  if p_detalle is null
     or jsonb_typeof(p_detalle) <> 'array'
     or jsonb_array_length(p_detalle) = 0 then
    raise exception 'El comprobante debe tener al menos una linea de detalle' using errcode = 'CMP07';
  end if;

  select count(*) into v_invalidas
  from jsonb_array_elements(p_detalle) as e(value)
  where coalesce((e.value->>'cantidad')::numeric, 0) <= 0
     or coalesce((e.value->>'precio_unitario')::numeric, 0) < 0
     or (nullif(e.value->>'id_producto', '') is null
         and coalesce(btrim(e.value->>'concepto'), '') = '');
  if v_invalidas > 0 then
    raise exception 'Hay lineas invalidas: cada linea necesita articulo o concepto, cantidad mayor a cero y precio no negativo'
      using errcode = 'CMP07';
  end if;

  select v.total_detalle, v.coincide
    into v_total_detalle, v_coincide
  from public.fn_comprobante_detalle_validar(p_detalle, p_importe_total) v;

  if v_coincide = false
     and coalesce(p_confirmar_diferencia, false) = false then
    raise exception 'La suma del detalle (%) no coincide con el importe total (%). Confirma la diferencia para continuar.',
      to_char(round(v_total_detalle, 2), 'FM999999999990.00'),
      to_char(round(p_importe_total, 2), 'FM999999999990.00')
      using errcode = 'CMP10';
  end if;

  if exists (
    select 1 from public.comprobante_proveedor
    where id_proveedor = p_id_proveedor
      and id_tipo_comprobante = p_id_tipo_comprobante
      and punto_venta = p_punto_venta
      and numero = p_numero
  ) then
    raise exception 'Ya existe un comprobante de ese proveedor, tipo, punto de venta y numero' using errcode = 'CMP04';
  end if;

  begin
    insert into public.comprobante_proveedor (
      id_proveedor, id_tipo_comprobante, punto_venta, numero,
      fecha_comprobante, fecha_vencimiento, importe_total, saldo_pendiente,
      id_compra, observaciones, estado, creado_por
    ) values (
      p_id_proveedor, p_id_tipo_comprobante, p_punto_venta, p_numero,
      p_fecha_comprobante, p_fecha_vencimiento, p_importe_total, p_importe_total,
      p_id_compra, nullif(btrim(p_observaciones), ''), 'Pendiente', coalesce(p_creado_por, auth.uid())
    )
    returning * into v_comprobante;
  exception
    when unique_violation then
      raise exception 'Ya existe un comprobante de ese proveedor, tipo, punto de venta y numero' using errcode = 'CMP04';
  end;

  insert into public.comprobante_proveedor_detalle (
    id_comprobante, nro_linea, id_producto, concepto, cantidad, precio_unitario
  )
  select
    v_comprobante.id_comprobante,
    e.ord::integer,
    nullif(e.value->>'id_producto', '')::uuid,
    nullif(btrim(e.value->>'concepto'), ''),
    (e.value->>'cantidad')::numeric,
    (e.value->>'precio_unitario')::numeric
  from jsonb_array_elements(p_detalle) with ordinality as e(value, ord);

  return v_comprobante;
end;
$function$;


-- ---------------------------------------------------------------------
-- fn_comprobante_anular - baja logica; el estado pasa a 'Anulado'
-- ---------------------------------------------------------------------
create or replace function public.fn_comprobante_anular(p_id_comprobante uuid)
returns public.comprobante_proveedor
language plpgsql
set search_path to 'public'
as $function$
declare
  v_comprobante public.comprobante_proveedor;
begin
  if not exists (select 1 from public.comprobante_proveedor where id_comprobante = p_id_comprobante) then
    raise exception 'El comprobante indicado no existe' using errcode = 'CMP08';
  end if;

  update public.comprobante_proveedor
  set anulado = true,
      estado  = 'Anulado'
  where id_comprobante = p_id_comprobante
  returning * into v_comprobante;

  return v_comprobante;
end;
$function$;


-- ---------------------------------------------------------------------
-- fn_comprobante_listar - suma param p_estado + columna estado
-- Cambia la firma de retorno: hay que DROP antes del CREATE.
-- ---------------------------------------------------------------------
drop function if exists public.fn_comprobante_listar(uuid, boolean, date, date);

create or replace function public.fn_comprobante_listar(
  p_id_proveedor uuid default null,
  p_solo_pendientes boolean default false,
  p_desde date default null,
  p_hasta date default null,
  p_estado public.estado_comprobante_proveedor default null
)
returns table (
  id_comprobante uuid,
  id_proveedor uuid,
  nombre_proveedor text,
  id_tipo_comprobante uuid,
  nombre_tipo_comprobante text,
  letra character,
  signo smallint,
  punto_venta integer,
  numero integer,
  numero_formateado text,
  fecha_comprobante date,
  fecha_vencimiento date,
  importe_total numeric,
  saldo_pendiente numeric,
  id_compra uuid,
  observaciones text,
  anulado boolean,
  estado public.estado_comprobante_proveedor,
  creado timestamptz,
  editado timestamptz,
  creado_por uuid,
  creado_por_nombre text
)
language sql
stable
set search_path to 'public'
as $function$
  select
    c.id_comprobante,
    c.id_proveedor,
    p.nombre_proveedor,
    c.id_tipo_comprobante,
    tc.nombre_tipo_comprobante,
    tc.letra,
    tc.signo,
    c.punto_venta,
    c.numero,
    lpad(c.punto_venta::text, 5, '0') || '-' || lpad(c.numero::text, 8, '0') as numero_formateado,
    c.fecha_comprobante,
    c.fecha_vencimiento,
    c.importe_total,
    c.saldo_pendiente,
    c.id_compra,
    c.observaciones,
    c.anulado,
    c.estado,
    c.creado,
    c.editado,
    c.creado_por,
    coalesce(ur.nombre_completo, 'Usuario no disponible') as creado_por_nombre
  from public.comprobante_proveedor c
  join public.proveedor p on p.id_proveedor = c.id_proveedor
  join public.tipo_comprobante tc on tc.id_tipo_comprobante = c.id_tipo_comprobante
  left join public.vw_usuario_resumen ur on ur.id_usuario = c.creado_por
  where (p_id_proveedor is null or c.id_proveedor = p_id_proveedor)
    and (p_solo_pendientes = false or (c.saldo_pendiente > 0 and c.anulado = false))
    and (p_desde is null or c.fecha_comprobante >= p_desde)
    and (p_hasta is null or c.fecha_comprobante <= p_hasta)
    and (p_estado is null or c.estado = p_estado)
  order by c.fecha_comprobante desc, c.creado desc;
$function$;

comment on function public.fn_comprobante_listar(uuid, boolean, date, date, public.estado_comprobante_proveedor) is
  'C-05 / T-C1 | Listado enriquecido de comprobantes. Filtros opcionales por proveedor, saldo pendiente, rango de fechas y estado. Incluye la columna estado (D-013).';


-- ---------------------------------------------------------------------
-- fn_comprobante_obtener - suma la columna estado
-- Cambia la firma de retorno: hay que DROP antes del CREATE.
-- ---------------------------------------------------------------------
drop function if exists public.fn_comprobante_obtener(uuid);

create or replace function public.fn_comprobante_obtener(p_id_comprobante uuid)
returns table (
  id_comprobante uuid,
  id_proveedor uuid,
  nombre_proveedor text,
  id_tipo_comprobante uuid,
  nombre_tipo_comprobante text,
  letra character,
  signo smallint,
  punto_venta integer,
  numero integer,
  numero_formateado text,
  fecha_comprobante date,
  fecha_vencimiento date,
  importe_total numeric,
  saldo_pendiente numeric,
  id_compra uuid,
  observaciones text,
  anulado boolean,
  estado public.estado_comprobante_proveedor,
  creado timestamptz,
  editado timestamptz,
  creado_por uuid,
  creado_por_nombre text,
  total_detalle numeric,
  diferencia numeric
)
language sql
stable
set search_path to 'public'
as $function$
  select
    c.id_comprobante,
    c.id_proveedor,
    p.nombre_proveedor,
    c.id_tipo_comprobante,
    tc.nombre_tipo_comprobante,
    tc.letra,
    tc.signo,
    c.punto_venta,
    c.numero,
    lpad(c.punto_venta::text, 5, '0') || '-' || lpad(c.numero::text, 8, '0') as numero_formateado,
    c.fecha_comprobante,
    c.fecha_vencimiento,
    c.importe_total,
    c.saldo_pendiente,
    c.id_compra,
    c.observaciones,
    c.anulado,
    c.estado,
    c.creado,
    c.editado,
    c.creado_por,
    coalesce(ur.nombre_completo, 'Usuario no disponible') as creado_por_nombre,
    coalesce(d.total_detalle, 0) as total_detalle,
    round(c.importe_total, 2) - coalesce(d.total_detalle, 0) as diferencia
  from public.comprobante_proveedor c
  join public.proveedor p on p.id_proveedor = c.id_proveedor
  join public.tipo_comprobante tc on tc.id_tipo_comprobante = c.id_tipo_comprobante
  left join public.vw_usuario_resumen ur on ur.id_usuario = c.creado_por
  left join lateral (
    select round(coalesce(sum(det.importe_linea), 0), 2) as total_detalle
    from public.comprobante_proveedor_detalle det
    where det.id_comprobante = c.id_comprobante
  ) d on true
  where c.id_comprobante = p_id_comprobante;
$function$;

comment on function public.fn_comprobante_obtener(uuid) is
  'C-11 / T-C1 | Cabecera de un comprobante enriquecida (proveedor, tipo, signo, numero_formateado, saldo, estado, creado_por_nombre) con total_detalle y diferencia frente al importe total.';
