-- S5-5b (E-03, D-027, D-031): alta del pedido web desde la tienda.
-- Revalida precio (lista Minorista vigente) y stock en servidor reutilizando fn_tienda_carrito_validar,
-- y crea el pedido en 'Pendiente de pago'. No descuenta stock ni genera comprobante (S5-6b).
-- p_items: igual que fn_tienda_carrito_validar. p_medio: tipo de medio de pago; por ahora solo
-- 'Transferencia' (D-031). El cliente sale de auth.uid() (cliente.id_usuario).
-- Errcodes: PWB01 (sin cliente web activo para la sesion), PWB02 (medio no disponible),
-- PWB03 (carrito vacio), PWB04 (hay lineas que no estan ok; el DETAIL lista id_producto:estado).
-- CAR01/CAR02 se propagan desde fn_tienda_carrito_validar.
-- Aditiva: funcion nueva. Reversion: drop function public.fn_pedido_web_registrar(jsonb, text).
create or replace function public.fn_pedido_web_registrar(p_items jsonb, p_medio text)
returns table(id_pedido uuid, numero integer, importe_total numeric)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id_cliente uuid;
  v_id_medio uuid;
  v_id_pedido uuid;
  v_numero integer;
  v_total numeric(14,2);
  v_malas text;
  v_lineas jsonb;
begin
  select c.id_cliente into v_id_cliente
  from public.cliente c
  where c.id_usuario = auth.uid() and c.activo = true;
  if v_id_cliente is null then
    raise exception 'No hay un cliente web activo para esta sesion' using errcode = 'PWB01';
  end if;

  if p_medio is distinct from 'Transferencia' then
    raise exception 'Medio de pago no disponible' using errcode = 'PWB02';
  end if;
  select mp.id_medio_pago into v_id_medio
  from public.medio_pago mp
  where mp.tipo::text = 'Transferencia' and mp.activo
  order by mp.nombre_medio_pago
  limit 1;
  if v_id_medio is null then
    raise exception 'Medio de pago no disponible' using errcode = 'PWB02';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id_producto', v.id_producto, 'cantidad', v.cantidad_solicitada,
           'precio', v.precio, 'estado', v.estado)), '[]'::jsonb)
    into v_lineas
  from public.fn_tienda_carrito_validar(p_items) v;

  if jsonb_array_length(v_lineas) = 0 then
    raise exception 'El carrito esta vacio' using errcode = 'PWB03';
  end if;

  select string_agg(l.id_producto || ':' || l.estado, ', ') into v_malas
  from jsonb_to_recordset(v_lineas) as l(id_producto uuid, cantidad numeric, precio numeric, estado text)
  where l.estado <> 'ok';
  if v_malas is not null then
    raise exception 'Hay articulos sin stock o no disponibles' using errcode = 'PWB04', detail = v_malas;
  end if;

  select sum(round(l.cantidad * l.precio, 2)) into v_total
  from jsonb_to_recordset(v_lineas) as l(id_producto uuid, cantidad numeric, precio numeric, estado text);

  insert into public.pedido_web (id_cliente, id_medio_pago, subtotal, importe_total)
  values (v_id_cliente, v_id_medio, v_total, v_total)
  returning pedido_web.id_pedido, pedido_web.numero into v_id_pedido, v_numero;

  insert into public.pedido_web_detalle (id_pedido, nro_linea, id_producto, cantidad, precio_unitario)
  select v_id_pedido, row_number() over (order by l.id_producto), l.id_producto, l.cantidad, l.precio
  from jsonb_to_recordset(v_lineas) as l(id_producto uuid, cantidad numeric, precio numeric, estado text);

  return query select v_id_pedido, v_numero, v_total;
end;
$function$;

revoke all on function public.fn_pedido_web_registrar(jsonb, text) from public, anon;
grant execute on function public.fn_pedido_web_registrar(jsonb, text) to authenticated, service_role;
