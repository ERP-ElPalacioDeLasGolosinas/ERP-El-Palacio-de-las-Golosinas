-- El desglose por deposito y por producto toma el importe neto de la venta.
-- El descuento del comprobante se reparte segun el peso de cada linea.

create or replace function public.fn_dashboard_por_deposito(
  p_desde date,
  p_hasta date
)
returns table (
  id_deposito uuid,
  nombre_deposito text,
  ingresos numeric
)
language sql
stable
set search_path to 'public'
as $$
  select
    d.id_deposito,
    d.nombre_deposito,
    round(coalesce(sum(
      cd.importe_linea * v.importe_total / nullif(v.subtotal, 0)
    ), 0), 2)
  from public.comprobante_venta_detalle cd
  join public.comprobante_venta v on v.id_comprobante = cd.id_comprobante
  join public.deposito d on d.id_deposito = cd.id_deposito
  where p_desde is not null
    and p_hasta is not null
    and p_desde <= p_hasta
    and v.fecha_comprobante between p_desde and p_hasta
  group by d.id_deposito, d.nombre_deposito
  having coalesce(sum(cd.importe_linea * v.importe_total / nullif(v.subtotal, 0)), 0) <> 0
  order by 3 desc, d.nombre_deposito;
$$;

create or replace function public.fn_dashboard_productos(
  p_desde date,
  p_hasta date
)
returns table (
  id_producto uuid,
  nombre_producto text,
  cantidad numeric,
  ingresos numeric
)
language sql
stable
set search_path to 'public'
as $$
  select
    p.id_producto,
    p.nombre_producto,
    round(coalesce(sum(cd.cantidad), 0), 3),
    round(coalesce(sum(
      cd.importe_linea * v.importe_total / nullif(v.subtotal, 0)
    ), 0), 2)
  from public.comprobante_venta_detalle cd
  join public.comprobante_venta v on v.id_comprobante = cd.id_comprobante
  join public.producto p on p.id_producto = cd.id_producto
  where p_desde is not null
    and p_hasta is not null
    and p_desde <= p_hasta
    and v.fecha_comprobante between p_desde and p_hasta
  group by p.id_producto, p.nombre_producto
  order by 4 desc, p.nombre_producto
  limit 5;
$$;

revoke execute on function public.fn_dashboard_por_deposito(date, date) from public, anon;
revoke execute on function public.fn_dashboard_productos(date, date) from public, anon;
grant execute on function public.fn_dashboard_por_deposito(date, date) to authenticated, service_role;
grant execute on function public.fn_dashboard_productos(date, date) to authenticated, service_role;

notify pgrst, 'reload schema';
