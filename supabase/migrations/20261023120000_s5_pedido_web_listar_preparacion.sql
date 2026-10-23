-- S5-20b · fn_pedido_web_listar orientada a la preparación.
-- Suma: estado_desde (fecha del último cambio de estado; creado si no hay historial),
-- cantidad_unidades (suma de cantidades), id_deposito_preparacion (= id_deposito_retiro; NULL en
-- envíos porque el stock sale de varios depósitos) y el parámetro p_deposito, que filtra solo
-- retiros por sucursal. Orden y resto de columnas sin cambios.
-- Cambia el tipo de retorno: DROP + CREATE (solo lectura, sin datos afectados).
-- Reversión: reaplicar 20261022160000_s5_pedido_web_listar_obtener_entrega.sql (bloque listar).

drop function if exists public.fn_pedido_web_listar(estado_pedido_web, date, date);

create function public.fn_pedido_web_listar(
  p_estado estado_pedido_web default null,
  p_desde date default null,
  p_hasta date default null,
  p_deposito uuid default null
)
returns table(
  id_pedido uuid, numero integer, id_cliente uuid, nombre_cliente text, estado text,
  importe_total numeric, cantidad_lineas bigint, medio_pago text, creado timestamptz,
  tipo_entrega text, nombre_deposito_retiro text, a_preparar boolean,
  estado_desde timestamptz, cantidad_unidades numeric, id_deposito_preparacion uuid
)
language sql
stable
set search_path to 'public'
as $function$
  select pw.id_pedido, pw.numero, pw.id_cliente, c.nombre_cliente, pw.estado::text,
         pw.importe_total,
         (select count(*) from public.pedido_web_detalle d where d.id_pedido = pw.id_pedido),
         mp.nombre_medio_pago, pw.creado,
         pw.tipo_entrega::text, dep.nombre_deposito,
         pw.estado in ('Pagado', 'En preparación'),
         coalesce(
           (select max(h.fecha) from public.pedido_web_historial_estado h
             where h.id_pedido = pw.id_pedido and h.estado = pw.estado),
           pw.creado),
         coalesce((select sum(d.cantidad) from public.pedido_web_detalle d
                    where d.id_pedido = pw.id_pedido), 0),
         pw.id_deposito_retiro
  from public.pedido_web pw
  join public.cliente c on c.id_cliente = pw.id_cliente
  join public.medio_pago mp on mp.id_medio_pago = pw.id_medio_pago
  left join public.deposito dep on dep.id_deposito = pw.id_deposito_retiro
  where (p_estado is null or pw.estado = p_estado)
    and (p_desde is null or (pw.creado at time zone 'America/Argentina/Buenos_Aires')::date >= p_desde)
    and (p_hasta is null or (pw.creado at time zone 'America/Argentina/Buenos_Aires')::date <= p_hasta)
    and (p_deposito is null or pw.id_deposito_retiro = p_deposito)
  order by case
             when pw.estado in ('Pagado', 'En preparación') then 0
             when pw.estado = 'Pendiente de pago' then 1
             when pw.estado = 'Listo para retirar' then 2
             else 3
           end,
           case when pw.estado in ('Pagado', 'En preparación') then pw.creado end asc,
           pw.creado desc;
$function$;

revoke all on function public.fn_pedido_web_listar(estado_pedido_web, date, date, uuid) from public, anon;
grant execute on function public.fn_pedido_web_listar(estado_pedido_web, date, date, uuid) to authenticated, service_role;
