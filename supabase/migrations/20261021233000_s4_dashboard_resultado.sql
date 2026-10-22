-- Dashboard: vendido, gastado y resultado, mes a mes, en un rango de fechas.
-- Ingresos = ventas. Egresos = facturas y notas de debito menos notas de credito.
-- Los remitos no suman. Los comprobantes anulados tampoco.

create or replace function public.fn_dashboard_mensual(
  p_desde date,
  p_hasta date
)
returns table (
  mes date,
  ingresos numeric,
  egresos numeric,
  resultado numeric
)
language sql
stable
set search_path to 'public'
as $$
  with meses as (
    select generate_series(
      date_trunc('month', p_desde)::date,
      date_trunc('month', p_hasta)::date,
      interval '1 month'
    )::date as mes
    where p_desde is not null
      and p_hasta is not null
      and p_desde <= p_hasta
  ),
  ventas as (
    select date_trunc('month', v.fecha_comprobante)::date as mes,
           round(coalesce(sum(v.importe_total), 0), 2) as ingresos
    from public.comprobante_venta v
    where v.fecha_comprobante between p_desde and p_hasta
    group by 1
  ),
  compras as (
    select date_trunc('month', c.fecha_comprobante)::date as mes,
           round(coalesce(sum(
             case tc.clase
               when 'nota_credito' then -c.importe_total
               when 'remito' then 0
               else c.importe_total
             end
           ), 0), 2) as egresos
    from public.comprobante_proveedor c
    join public.tipo_comprobante tc on tc.id_tipo_comprobante = c.id_tipo_comprobante
    where c.anulado = false
      and c.fecha_comprobante between p_desde and p_hasta
    group by 1
  )
  select
    m.mes,
    coalesce(v.ingresos, 0),
    coalesce(c.egresos, 0),
    round(coalesce(v.ingresos, 0) - coalesce(c.egresos, 0), 2)
  from meses m
  left join ventas v on v.mes = m.mes
  left join compras c on c.mes = m.mes
  order by m.mes;
$$;

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
    round(coalesce(sum(cd.importe_linea), 0), 2)
  from public.comprobante_venta_detalle cd
  join public.comprobante_venta v on v.id_comprobante = cd.id_comprobante
  join public.deposito d on d.id_deposito = cd.id_deposito
  where p_desde is not null
    and p_hasta is not null
    and p_desde <= p_hasta
    and v.fecha_comprobante between p_desde and p_hasta
  group by d.id_deposito, d.nombre_deposito
  having coalesce(sum(cd.importe_linea), 0) <> 0
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
    round(coalesce(sum(cd.importe_linea), 0), 2)
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

revoke execute on function public.fn_dashboard_mensual(date, date) from public, anon;
revoke execute on function public.fn_dashboard_por_deposito(date, date) from public, anon;
revoke execute on function public.fn_dashboard_productos(date, date) from public, anon;
grant execute on function public.fn_dashboard_mensual(date, date) to authenticated, service_role;
grant execute on function public.fn_dashboard_por_deposito(date, date) to authenticated, service_role;
grant execute on function public.fn_dashboard_productos(date, date) to authenticated, service_role;

notify pgrst, 'reload schema';
