-- S5-19g · fn_pedido_web_listar / fn_pedido_web_obtener con datos de entrega.
-- listar: suma tipo_entrega, deposito de retiro y a_preparar; ordena primero lo pendiente de
-- preparar (Pagado, En preparación; el más viejo primero), luego Pendiente de pago, Listo para
-- retirar y al final lo terminado (más reciente primero).
-- obtener: suma tipo_entrega, costo_envio, datos de envío y deposito de retiro.
-- Cambia el tipo de retorno: DROP + CREATE (solo lectura, sin datos afectados).

drop function if exists public.fn_pedido_web_listar(estado_pedido_web, date, date);

create function public.fn_pedido_web_listar(
  p_estado estado_pedido_web default null,
  p_desde date default null,
  p_hasta date default null
)
returns table(
  id_pedido uuid, numero integer, id_cliente uuid, nombre_cliente text, estado text,
  importe_total numeric, cantidad_lineas bigint, medio_pago text, creado timestamptz,
  tipo_entrega text, nombre_deposito_retiro text, a_preparar boolean
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
         pw.estado in ('Pagado', 'En preparación')
  from public.pedido_web pw
  join public.cliente c on c.id_cliente = pw.id_cliente
  join public.medio_pago mp on mp.id_medio_pago = pw.id_medio_pago
  left join public.deposito dep on dep.id_deposito = pw.id_deposito_retiro
  where (p_estado is null or pw.estado = p_estado)
    and (p_desde is null or (pw.creado at time zone 'America/Argentina/Buenos_Aires')::date >= p_desde)
    and (p_hasta is null or (pw.creado at time zone 'America/Argentina/Buenos_Aires')::date <= p_hasta)
  order by case
             when pw.estado in ('Pagado', 'En preparación') then 0
             when pw.estado = 'Pendiente de pago' then 1
             when pw.estado = 'Listo para retirar' then 2
             else 3
           end,
           case when pw.estado in ('Pagado', 'En preparación') then pw.creado end asc,
           pw.creado desc;
$function$;

revoke all on function public.fn_pedido_web_listar(estado_pedido_web, date, date) from public, anon;
grant execute on function public.fn_pedido_web_listar(estado_pedido_web, date, date) to authenticated, service_role;

drop function if exists public.fn_pedido_web_obtener(uuid);

create function public.fn_pedido_web_obtener(p_id uuid)
returns table(
  id_pedido uuid, numero integer, estado text, subtotal numeric, importe_total numeric,
  observaciones text, creado timestamptz, fecha_pago timestamptz, id_comprobante uuid,
  medio_pago text, id_cliente uuid, nombre_cliente text, documento_cliente text,
  telefono_cliente text, mail_cliente text, direccion_cliente text, lineas jsonb,
  tipo_entrega text, costo_envio numeric, envio_destinatario text, envio_direccion text,
  envio_localidad text, envio_observaciones text, nombre_deposito_retiro text
)
language sql
stable
set search_path to 'public'
as $function$
  select pw.id_pedido, pw.numero, pw.estado::text, pw.subtotal, pw.importe_total, pw.observaciones,
         pw.creado, pw.fecha_pago, pw.id_comprobante, mp.nombre_medio_pago,
         c.id_cliente, c.nombre_cliente, c.documento_cliente, c.telefono_cliente, c.mail_cliente,
         c.direccion_cliente,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'nro_linea', d.nro_linea,
                    'id_producto', d.id_producto,
                    'codigo_producto', p.codigo_producto,
                    'nombre_producto', p.nombre_producto,
                    'nombre_marca', m.nombre_marca,
                    'presentacion', p.numero_medida || ' ' || um.abreviatura,
                    'cantidad', d.cantidad,
                    'precio_unitario', d.precio_unitario,
                    'importe_linea', d.importe_linea) order by d.nro_linea)
           from public.pedido_web_detalle d
           join public.producto p on p.id_producto = d.id_producto
           left join public.marca m on m.id_marca = p.id_marca
           left join public.unidad_medida um on um.id_unidad_medida = p.id_unidad_medida
           where d.id_pedido = pw.id_pedido
         ), '[]'::jsonb),
         pw.tipo_entrega::text, pw.costo_envio, pw.envio_destinatario, pw.envio_direccion,
         pw.envio_localidad, pw.envio_observaciones, dep.nombre_deposito
  from public.pedido_web pw
  join public.cliente c on c.id_cliente = pw.id_cliente
  join public.medio_pago mp on mp.id_medio_pago = pw.id_medio_pago
  left join public.deposito dep on dep.id_deposito = pw.id_deposito_retiro
  where pw.id_pedido = p_id;
$function$;

revoke all on function public.fn_pedido_web_obtener(uuid) from public, anon;
grant execute on function public.fn_pedido_web_obtener(uuid) to authenticated, service_role;
