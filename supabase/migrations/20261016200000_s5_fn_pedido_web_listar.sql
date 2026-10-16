-- S5-9a (AO-04): listado de pedidos web para el personal del ERP.
-- SECURITY INVOKER: el acceso lo filtra la RLS de pedido_web / cliente (solo personal, D-030).
-- Filtros opcionales por estado y por rango de fecha de creacion (dia local America/Argentina/Buenos_Aires).
-- Aditiva: funcion nueva. Reversion: drop function public.fn_pedido_web_listar(public.estado_pedido_web, date, date).
create or replace function public.fn_pedido_web_listar(
  p_estado public.estado_pedido_web default null,
  p_desde date default null,
  p_hasta date default null
)
returns table(
  id_pedido uuid,
  numero integer,
  id_cliente uuid,
  nombre_cliente text,
  estado text,
  importe_total numeric,
  cantidad_lineas bigint,
  medio_pago text,
  creado timestamptz
)
language sql
stable
set search_path to 'public'
as $function$
  select pw.id_pedido, pw.numero, pw.id_cliente, c.nombre_cliente, pw.estado::text,
         pw.importe_total,
         (select count(*) from public.pedido_web_detalle d where d.id_pedido = pw.id_pedido),
         mp.nombre_medio_pago, pw.creado
  from public.pedido_web pw
  join public.cliente c on c.id_cliente = pw.id_cliente
  join public.medio_pago mp on mp.id_medio_pago = pw.id_medio_pago
  where (p_estado is null or pw.estado = p_estado)
    and (p_desde is null or (pw.creado at time zone 'America/Argentina/Buenos_Aires')::date >= p_desde)
    and (p_hasta is null or (pw.creado at time zone 'America/Argentina/Buenos_Aires')::date <= p_hasta)
  order by pw.creado desc;
$function$;

revoke all on function public.fn_pedido_web_listar(public.estado_pedido_web, date, date) from public, anon;
grant execute on function public.fn_pedido_web_listar(public.estado_pedido_web, date, date) to authenticated, service_role;
