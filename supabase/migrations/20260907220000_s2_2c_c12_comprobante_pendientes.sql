-- =====================================================================
-- S2-2c | C-12 Comprobantes pendientes por proveedor (P2)
-- Sprint 2 - ERP El Palacio de las Golosinas
--
-- Estado: aplicada en Supabase el 2026-09-07 (migracion 20260907220000).
--
-- Al elegir un proveedor, la pantalla /compras/comprobantes/pendientes
-- lista solo sus comprobantes con saldo pendiente > 0, ordenables por
-- fecha de comprobante o por vencimiento, mostrando el saldo neto.
-- Insumo de T-07 (ordenes de pago).
--
--   - fn_comprobante_pendientes_listar(p_id_proveedor, p_orden)  [NUEVA]
--       Filtro fijo: saldo_pendiente > 0 and anulado = false and
--       estado <> 'Pagado'. p_orden in ('fecha','vencimiento');
--       cualquier otro valor cae a 'fecha'. Orden ascendente (el saldo
--       mas viejo primero); los comprobantes sin vencimiento van al
--       final cuando se ordena por vencimiento.
--   - fn_comprobante_pendientes_resumen(p_id_proveedor)          [NUEVA]
--       (cantidad, saldo_pendiente) del mismo conjunto. Lo consume T-07.
--
-- Patron: SQL stable, SECURITY INVOKER, sin GRANT explicito (igual que
-- fn_comprobante_listar / fn_comprobante_resumen); el acceso a datos
-- pasa por RLS authenticated (D-010).
-- =====================================================================

create or replace function public.fn_comprobante_pendientes_listar(
  p_id_proveedor uuid,
  p_orden text default 'fecha'
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
  estado public.estado_comprobante_proveedor
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
    c.estado
  from public.comprobante_proveedor c
  join public.proveedor p on p.id_proveedor = c.id_proveedor
  join public.tipo_comprobante tc on tc.id_tipo_comprobante = c.id_tipo_comprobante
  where c.id_proveedor = p_id_proveedor
    and c.saldo_pendiente > 0
    and c.anulado = false
    and c.estado <> 'Pagado'
  order by
    case when p_orden = 'vencimiento' then c.fecha_vencimiento end asc nulls last,
    c.fecha_comprobante asc,
    c.creado asc;
$function$;

comment on function public.fn_comprobante_pendientes_listar(uuid, text) is
  'S2-2c | Comprobantes de un proveedor con saldo pendiente > 0, no anulados y estado <> Pagado. p_orden = fecha | vencimiento.';

create or replace function public.fn_comprobante_pendientes_resumen(
  p_id_proveedor uuid
)
returns table (
  cantidad bigint,
  saldo_pendiente numeric
)
language sql
stable
set search_path to 'public'
as $function$
  select
    count(*)::bigint as cantidad,
    coalesce(sum(c.saldo_pendiente), 0) as saldo_pendiente
  from public.comprobante_proveedor c
  where c.id_proveedor = p_id_proveedor
    and c.saldo_pendiente > 0
    and c.anulado = false
    and c.estado <> 'Pagado';
$function$;

comment on function public.fn_comprobante_pendientes_resumen(uuid) is
  'S2-2c | Cantidad y suma de saldos pendientes de un proveedor (mismo conjunto que fn_comprobante_pendientes_listar). Insumo de T-07.';
