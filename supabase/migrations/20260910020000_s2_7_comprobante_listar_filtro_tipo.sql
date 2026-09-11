-- =====================================================================
-- S2-7 paso 2 | Filtro por tipo de comprobante en el historial (D-022)
-- Sprint 2 - ERP El Palacio de las Golosinas
--
-- Estado: aplicada en Supabase el 2026-09-10.
--
-- fn_comprobante_listar gana:
--   (a) parametro p_id_tipo_comprobante uuid DEFAULT NULL para acotar el
--       listado a un tipo de comprobante concreto;
--   (b) columna clase text en el RETURNS TABLE (desde tipo_comprobante),
--       para que el front pueda distinguir factura / NC / ND / remito sin
--       otra consulta.
--
-- El id_tipo_comprobante ya se devolvia. Cambia la firma y el RETURNS
-- TABLE, asi que hay DROP + CREATE. Patron identico al estado previo:
-- SQL STABLE, SECURITY INVOKER, GRANT EXECUTE a anon/authenticated/
-- service_role.
-- =====================================================================

DROP FUNCTION IF EXISTS public.fn_comprobante_listar(
  uuid, boolean, date, date, estado_comprobante_proveedor);

CREATE FUNCTION public.fn_comprobante_listar(
  p_id_proveedor uuid DEFAULT NULL::uuid,
  p_solo_pendientes boolean DEFAULT false,
  p_desde date DEFAULT NULL::date,
  p_hasta date DEFAULT NULL::date,
  p_estado estado_comprobante_proveedor DEFAULT NULL::estado_comprobante_proveedor,
  p_id_tipo_comprobante uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  id_comprobante uuid,
  id_proveedor uuid,
  nombre_proveedor text,
  id_tipo_comprobante uuid,
  nombre_tipo_comprobante text,
  letra character,
  clase text,
  punto_venta integer,
  numero integer,
  numero_formateado text,
  fecha_comprobante date,
  fecha_vencimiento date,
  subtotal numeric,
  descuento_total numeric,
  impuesto_total numeric,
  importe_total numeric,
  saldo_pendiente numeric,
  observaciones text,
  anulado boolean,
  estado estado_comprobante_proveedor,
  creado timestamp with time zone,
  editado timestamp with time zone,
  creado_por uuid,
  creado_por_nombre text
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  select
    c.id_comprobante, c.id_proveedor, p.nombre_proveedor,
    c.id_tipo_comprobante, tc.nombre_tipo_comprobante, tc.letra, tc.clase,
    c.punto_venta, c.numero,
    lpad(c.punto_venta::text, 5, '0') || '-' || lpad(c.numero::text, 8, '0') as numero_formateado,
    c.fecha_comprobante, c.fecha_vencimiento,
    c.subtotal, c.descuento_total, c.impuesto_total,
    c.importe_total, c.saldo_pendiente,
    c.observaciones, c.anulado, c.estado,
    c.creado, c.editado, c.creado_por,
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
    and (p_id_tipo_comprobante is null or c.id_tipo_comprobante = p_id_tipo_comprobante)
  order by c.fecha_comprobante desc, c.creado desc;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_comprobante_listar(
  uuid, boolean, date, date, estado_comprobante_proveedor, uuid)
  TO anon, authenticated, service_role;
