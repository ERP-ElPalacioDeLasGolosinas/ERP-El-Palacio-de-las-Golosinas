-- =====================================================================
-- S2-2b | C-11 Detalle del comprobante de proveedor
-- Sprint 2 - ERP El Palacio de las Golosinas
--
-- Estado: aplicada en Supabase el 2026-09-07 (migracion 20260907183714).
--
-- Agrega la consulta de detalle y centraliza la regla de coincidencia
-- entre la suma de las lineas y el importe total:
--   - fn_comprobante_detalle_validar(p_detalle, p_importe_total)
--       -> total_detalle, diferencia, coincide. La usa el formulario de
--          alta ANTES de confirmar y la reusa fn_comprobante_registrar.
--   - fn_comprobante_obtener(p_id_comprobante)
--       -> cabecera enriquecida (misma forma que fn_comprobante_listar)
--          + total_detalle + diferencia.
--   - fn_comprobante_detalle_listar(p_id_comprobante)
--       -> lineas con nombre_producto (LEFT JOIN producto) o concepto.
--
-- fn_comprobante_registrar reemplaza su validacion inline de diferencia
-- por una llamada a fn_comprobante_detalle_validar; el codigo CMP10 y su
-- mensaje se mantienen sin cambios.
-- Patron: SECURITY INVOKER, sin GRANT explicito (igual que el resto de
-- fn_comprobante_*); el acceso a datos pasa por RLS authenticated (D-010).
-- =====================================================================


-- ---------------------------------------------------------------------
-- fn_comprobante_detalle_validar - regla de coincidencia detalle/total
-- ---------------------------------------------------------------------
create or replace function public.fn_comprobante_detalle_validar(
  p_detalle jsonb,
  p_importe_total numeric
)
returns table (
  total_detalle numeric,
  diferencia numeric,
  coincide boolean
)
language sql
stable
set search_path to 'public'
as $function$
  with sumado as (
    select coalesce(
      sum((e.value->>'cantidad')::numeric * (e.value->>'precio_unitario')::numeric),
      0
    ) as total
    from jsonb_array_elements(
      case
        when p_detalle is not null and jsonb_typeof(p_detalle) = 'array'
        then p_detalle
        else '[]'::jsonb
      end
    ) as e(value)
  )
  select
    round(s.total, 2) as total_detalle,
    round(coalesce(p_importe_total, 0), 2) - round(s.total, 2) as diferencia,
    round(coalesce(p_importe_total, 0), 2) = round(s.total, 2) as coincide
  from sumado s;
$function$;

comment on function public.fn_comprobante_detalle_validar(jsonb, numeric) is
  'C-11 | Suma el detalle (jsonb) y lo compara con el importe total. Devuelve total_detalle, diferencia y coincide. La usa el alta antes de confirmar y la reusa fn_comprobante_registrar (CMP10).';


-- ---------------------------------------------------------------------
-- fn_comprobante_obtener - cabecera enriquecida + totales del detalle
-- ---------------------------------------------------------------------
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
  'C-11 | Cabecera de un comprobante enriquecida (proveedor, tipo, signo, numero_formateado, saldo, creado_por_nombre) con total_detalle y diferencia frente al importe total.';


-- ---------------------------------------------------------------------
-- fn_comprobante_detalle_listar - lineas del comprobante
-- ---------------------------------------------------------------------
create or replace function public.fn_comprobante_detalle_listar(p_id_comprobante uuid)
returns table (
  id_detalle uuid,
  nro_linea integer,
  id_producto uuid,
  nombre_producto text,
  concepto text,
  cantidad numeric,
  precio_unitario numeric,
  importe_linea numeric
)
language sql
stable
set search_path to 'public'
as $function$
  select
    det.id_detalle,
    det.nro_linea,
    det.id_producto,
    pr.nombre_producto::text,
    det.concepto,
    det.cantidad,
    det.precio_unitario,
    det.importe_linea
  from public.comprobante_proveedor_detalle det
  left join public.producto pr on pr.id_producto = det.id_producto
  where det.id_comprobante = p_id_comprobante
  order by det.nro_linea;
$function$;

comment on function public.fn_comprobante_detalle_listar(uuid) is
  'C-11 | Lineas de un comprobante: nombre_producto (LEFT JOIN producto) o concepto libre, cantidad, precio unitario e importe de linea.';


-- ---------------------------------------------------------------------
-- fn_comprobante_registrar - usa fn_comprobante_detalle_validar (CMP10)
-- Reemplaza la suma inline del detalle por la funcion centralizada.
-- Resto del cuerpo sin cambios respecto de S2-2a.
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
      id_compra, observaciones, creado_por
    ) values (
      p_id_proveedor, p_id_tipo_comprobante, p_punto_venta, p_numero,
      p_fecha_comprobante, p_fecha_vencimiento, p_importe_total, p_importe_total,
      p_id_compra, nullif(btrim(p_observaciones), ''), coalesce(p_creado_por, auth.uid())
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
