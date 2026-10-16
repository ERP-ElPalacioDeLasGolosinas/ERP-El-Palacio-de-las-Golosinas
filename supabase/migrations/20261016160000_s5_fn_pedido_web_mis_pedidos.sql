-- S5-5d (E-03): "Mis pedidos" del cliente web.
-- El cliente web no lee pedido_web directo (RLS solo del personal, D-030); lee por estas funciones,
-- que filtran por el cliente de la sesion (cliente.id_usuario = auth.uid()).
--  * fn_pedido_web_mis_listar(): pedidos del cliente, mas nuevos primero.
--  * fn_pedido_web_mi_obtener(p_id_pedido): un pedido propio con sus lineas (jsonb); sin filas si
--    no existe o es de otro cliente (no se distingue, para no filtrar existencia).
-- Aditiva: funciones nuevas. Reversion: drop function public.fn_pedido_web_mis_listar();
-- drop function public.fn_pedido_web_mi_obtener(uuid).
create or replace function public.fn_pedido_web_mis_listar()
returns table(
  id_pedido uuid,
  numero integer,
  estado text,
  importe_total numeric,
  cantidad_lineas bigint,
  creado timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select pw.id_pedido, pw.numero, pw.estado::text, pw.importe_total,
         (select count(*) from public.pedido_web_detalle d where d.id_pedido = pw.id_pedido),
         pw.creado
  from public.pedido_web pw
  join public.cliente c on c.id_cliente = pw.id_cliente
  where c.id_usuario = auth.uid()
  order by pw.creado desc;
$function$;

create or replace function public.fn_pedido_web_mi_obtener(p_id_pedido uuid)
returns table(
  id_pedido uuid,
  numero integer,
  estado text,
  subtotal numeric,
  importe_total numeric,
  creado timestamptz,
  fecha_pago timestamptz,
  medio_pago text,
  lineas jsonb
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select pw.id_pedido, pw.numero, pw.estado::text, pw.subtotal, pw.importe_total, pw.creado,
         pw.fecha_pago, mp.nombre_medio_pago,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'nro_linea', d.nro_linea,
                    'id_producto', d.id_producto,
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
         ), '[]'::jsonb)
  from public.pedido_web pw
  join public.cliente c on c.id_cliente = pw.id_cliente
  join public.medio_pago mp on mp.id_medio_pago = pw.id_medio_pago
  where pw.id_pedido = p_id_pedido and c.id_usuario = auth.uid();
$function$;

revoke all on function public.fn_pedido_web_mis_listar() from public, anon;
grant execute on function public.fn_pedido_web_mis_listar() to authenticated, service_role;
revoke all on function public.fn_pedido_web_mi_obtener(uuid) from public, anon;
grant execute on function public.fn_pedido_web_mi_obtener(uuid) to authenticated, service_role;
