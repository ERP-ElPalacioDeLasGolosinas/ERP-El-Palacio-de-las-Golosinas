-- La factura solo puede elegir una orden a la que todavia le quede
-- cantidad por facturar. Una orden ya cubierta por facturas no anuladas
-- no vuelve a aparecer.

drop function if exists public.fn_orden_compra_listar(uuid, public.estado_orden_compra, date, date);

create function public.fn_orden_compra_listar(
  p_id_proveedor uuid default null,
  p_estado public.estado_orden_compra default null,
  p_desde date default null,
  p_hasta date default null
)
returns table (
  id_orden_compra uuid,
  numero integer,
  numero_formateado text,
  id_proveedor uuid,
  nombre_proveedor text,
  fecha_emision date,
  estado public.estado_orden_compra,
  cantidad_articulos bigint,
  creado timestamptz,
  creado_por_nombre text,
  pendiente_facturar boolean
)
language sql
stable
set search_path to 'public'
as $$
  select
    o.id_orden_compra,
    o.numero,
    'OC-' || lpad(o.numero::text, 6, '0'),
    o.id_proveedor,
    p.nombre_proveedor,
    o.fecha_emision,
    o.estado,
    (select count(*) from public.orden_compra_detalle d where d.id_orden_compra = o.id_orden_compra),
    o.creado,
    coalesce(u.nombre_completo, 'Usuario no disponible'),
    exists (
      select 1
      from public.orden_compra_detalle d
      where d.id_orden_compra = o.id_orden_compra
        and d.cantidad_solicitada > coalesce((
          select sum(cd.cantidad)
          from public.comprobante_proveedor_detalle cd
          join public.comprobante_proveedor c on c.id_comprobante = cd.id_comprobante
          join public.tipo_comprobante tc on tc.id_tipo_comprobante = c.id_tipo_comprobante
          where c.id_orden_compra = o.id_orden_compra
            and c.anulado = false
            and tc.clase = 'factura'
            and cd.id_producto = d.id_producto
        ), 0)
    )
  from public.orden_compra o
  join public.proveedor p on p.id_proveedor = o.id_proveedor
  left join public.vw_usuario_resumen u on u.id_usuario = o.creado_por
  where (p_id_proveedor is null or o.id_proveedor = p_id_proveedor)
    and (p_estado is null or o.estado = p_estado)
    and (p_desde is null or o.fecha_emision >= p_desde)
    and (p_hasta is null or o.fecha_emision <= p_hasta)
  order by o.fecha_emision desc, o.numero desc;
$$;

comment on function public.fn_orden_compra_listar(uuid, public.estado_orden_compra, date, date) is
  'Lista ordenes de compra. pendiente_facturar es true si queda cantidad por facturar.';

revoke execute on function public.fn_orden_compra_listar(uuid, public.estado_orden_compra, date, date) from public, anon;
grant execute on function public.fn_orden_compra_listar(uuid, public.estado_orden_compra, date, date) to authenticated, service_role;

notify pgrst, 'reload schema';
