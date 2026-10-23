-- S5-20c · fn_pedido_web_obtener suma `historial` (jsonb): cada cambio de estado con fecha y el
-- usuario que lo hizo (nombre y apellido; null si lo generó el sistema o el propio cliente web).
-- Es el mismo cuerpo de S5-19g con una columna más al final; hay que dropear porque cambia el RETURNS.

drop function if exists public.fn_pedido_web_obtener(uuid);

create function public.fn_pedido_web_obtener(p_id uuid)
returns table(
  id_pedido uuid, numero integer, estado text, subtotal numeric, importe_total numeric,
  observaciones text, creado timestamptz, fecha_pago timestamptz, id_comprobante uuid,
  medio_pago text, id_cliente uuid, nombre_cliente text, documento_cliente text,
  telefono_cliente text, mail_cliente text, direccion_cliente text, lineas jsonb,
  tipo_entrega text, costo_envio numeric, envio_destinatario text, envio_direccion text,
  envio_localidad text, envio_observaciones text, nombre_deposito_retiro text, historial jsonb
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
         pw.envio_localidad, pw.envio_observaciones, dep.nombre_deposito,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'estado', h.estado::text,
                    'fecha', h.fecha,
                    'usuario', nullif(trim(coalesce(u.nombre_usuario, '') || ' ' || coalesce(u.apellido_usuario, '')), ''))
                  order by h.fecha, h.id_historial)
           from public.pedido_web_historial_estado h
           left join public.usuario u on u.id_usuario = h.creado_por
           where h.id_pedido = pw.id_pedido
         ), '[]'::jsonb)
  from public.pedido_web pw
  join public.cliente c on c.id_cliente = pw.id_cliente
  join public.medio_pago mp on mp.id_medio_pago = pw.id_medio_pago
  left join public.deposito dep on dep.id_deposito = pw.id_deposito_retiro
  where pw.id_pedido = p_id;
$function$;

revoke all on function public.fn_pedido_web_obtener(uuid) from public, anon;
grant execute on function public.fn_pedido_web_obtener(uuid) to authenticated, service_role;
