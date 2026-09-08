-- =====================================================================
-- T-C2 | Resumen agregado de comprobantes de proveedor (P0)
-- Sprint 2 - ERP El Palacio de las Golosinas
--
-- Estado: aplicada en Supabase el 2026-09-07 (migracion 20260907193000).
--
-- La pantalla /compras/comprobantes pasa a filtrar en el servidor
-- (proveedor, estado, rango de fechas) via fn_comprobante_listar y
-- necesita, ademas, los totales agregados del mismo conjunto filtrado.
--
--   - fn_comprobante_resumen(p_id_proveedor, p_desde, p_hasta, p_estado)
--       [NUEVA] -> (cantidad, importe_total, importe_pagado, saldo_pendiente)
--       Misma clausula WHERE que fn_comprobante_listar (sin
--       p_solo_pendientes): el resumen refleja exactamente la tabla
--       filtrada. importe_pagado = importe_total - saldo_pendiente.
--
-- Patron: SQL stable, SECURITY INVOKER, sin GRANT explicito (igual que
-- fn_comprobante_listar); el acceso a datos pasa por RLS authenticated
-- (D-010).
-- =====================================================================

create or replace function public.fn_comprobante_resumen(
  p_id_proveedor uuid default null,
  p_desde date default null,
  p_hasta date default null,
  p_estado public.estado_comprobante_proveedor default null
)
returns table (
  cantidad bigint,
  importe_total numeric,
  importe_pagado numeric,
  saldo_pendiente numeric
)
language sql
stable
set search_path to 'public'
as $function$
  select
    count(*)::bigint as cantidad,
    coalesce(sum(c.importe_total), 0) as importe_total,
    coalesce(sum(c.importe_total - c.saldo_pendiente), 0) as importe_pagado,
    coalesce(sum(c.saldo_pendiente), 0) as saldo_pendiente
  from public.comprobante_proveedor c
  where (p_id_proveedor is null or c.id_proveedor = p_id_proveedor)
    and (p_desde is null or c.fecha_comprobante >= p_desde)
    and (p_hasta is null or c.fecha_comprobante <= p_hasta)
    and (p_estado is null or c.estado = p_estado);
$function$;

comment on function public.fn_comprobante_resumen(uuid, date, date, public.estado_comprobante_proveedor) is
  'T-C2 | Totales agregados de comprobantes (cantidad, importe_total, importe_pagado, saldo_pendiente) para el mismo conjunto que fn_comprobante_listar filtra por proveedor, rango de fechas y estado.';
