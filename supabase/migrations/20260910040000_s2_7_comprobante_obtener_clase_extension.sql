-- S2-7 paso 6: fn_comprobante_obtener suma clase + datos de la extensión
-- (motivo de ND/NC, comprobante asociado con su número formateado y tipo)
-- para que el detalle adapte cabecera y columnas por tipo de documento.

DROP FUNCTION IF EXISTS public.fn_comprobante_obtener(uuid);

CREATE FUNCTION public.fn_comprobante_obtener(p_id_comprobante uuid)
 RETURNS TABLE(
   id_comprobante uuid, id_proveedor uuid, nombre_proveedor text,
   id_tipo_comprobante uuid, nombre_tipo_comprobante text, letra character,
   clase text,
   punto_venta integer, numero integer, numero_formateado text,
   fecha_comprobante date, fecha_vencimiento date,
   subtotal numeric, descuento_total numeric, impuesto_total numeric,
   importe_total numeric, saldo_pendiente numeric,
   observaciones text, anulado boolean, estado estado_comprobante_proveedor,
   creado timestamp with time zone, editado timestamp with time zone,
   creado_por uuid, creado_por_nombre text,
   total_detalle numeric,
   motivo text,
   id_comprobante_asociado uuid,
   numero_formateado_asociado text,
   nombre_tipo_comprobante_asociado text
 )
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select
    c.id_comprobante, c.id_proveedor, p.nombre_proveedor,
    c.id_tipo_comprobante, tc.nombre_tipo_comprobante, tc.letra,
    tc.clase,
    c.punto_venta, c.numero,
    lpad(c.punto_venta::text, 5, '0') || '-' || lpad(c.numero::text, 8, '0') as numero_formateado,
    c.fecha_comprobante, c.fecha_vencimiento,
    c.subtotal, c.descuento_total, c.impuesto_total,
    c.importe_total, c.saldo_pendiente,
    c.observaciones, c.anulado, c.estado,
    c.creado, c.editado, c.creado_por,
    coalesce(ur.nombre_completo, 'Usuario no disponible') as creado_por_nombre,
    coalesce(d.total_detalle, 0) as total_detalle,
    ext.motivo,
    ext.id_comprobante_asociado,
    case when asoc.id_comprobante is not null then
      lpad(asoc.punto_venta::text, 5, '0') || '-' || lpad(asoc.numero::text, 8, '0')
    end as numero_formateado_asociado,
    tca.nombre_tipo_comprobante as nombre_tipo_comprobante_asociado
  from public.comprobante_proveedor c
  join public.proveedor p on p.id_proveedor = c.id_proveedor
  join public.tipo_comprobante tc on tc.id_tipo_comprobante = c.id_tipo_comprobante
  left join public.vw_usuario_resumen ur on ur.id_usuario = c.creado_por
  left join lateral (
    select round(coalesce(sum(det.importe_linea), 0), 2) as total_detalle
    from public.comprobante_proveedor_detalle det
    where det.id_comprobante = c.id_comprobante
  ) d on true
  left join lateral (
    select nd.motivo, nd.id_comprobante_asociado
    from public.nota_debito_proveedor nd
    where tc.clase = 'nota_debito' and nd.id_comprobante = c.id_comprobante
    union all
    select nc.motivo, nc.id_comprobante_asociado
    from public.nota_credito_proveedor nc
    where tc.clase = 'nota_credito' and nc.id_comprobante = c.id_comprobante
    union all
    select null::text, rm.id_comprobante_asociado
    from public.remito_proveedor rm
    where tc.clase = 'remito' and rm.id_comprobante = c.id_comprobante
  ) ext on true
  left join public.comprobante_proveedor asoc on asoc.id_comprobante = ext.id_comprobante_asociado
  left join public.tipo_comprobante tca on tca.id_tipo_comprobante = asoc.id_tipo_comprobante
  where c.id_comprobante = p_id_comprobante;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_comprobante_obtener(uuid) TO anon, authenticated, service_role;
