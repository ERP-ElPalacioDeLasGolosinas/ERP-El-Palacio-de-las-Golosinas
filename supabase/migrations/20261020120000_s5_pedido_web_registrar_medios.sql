-- S5-18e · fn_pedido_web_registrar acepta Transferencia, Tarjeta de débito y Tarjeta de crédito.
--
-- Único cambio respecto de 20261017160000: p_medio ya no se limita a 'Transferencia'; se acepta
-- cualquiera de los tres y se elige el medio_pago activo de ese tipo (PWB02 si no hay ninguno).
-- Firma, retorno, grants y el resto del cuerpo no cambian.

create or replace function public.fn_pedido_web_registrar(p_items jsonb, p_medio text)
returns table(id_pedido uuid, numero integer, importe_total numeric)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id_cliente uuid;
  v_documento text;
  v_telefono text;
  v_id_medio uuid;
  v_id_pedido uuid;
  v_numero integer;
  v_total numeric(14,2);
  v_malas text;
  v_lineas jsonb;
begin
  select c.id_cliente, c.documento_cliente, c.telefono_cliente
    into v_id_cliente, v_documento, v_telefono
  from public.cliente c
  where c.id_usuario = auth.uid() and c.activo = true;
  if v_id_cliente is null then
    raise exception 'No hay un cliente web activo para esta sesion' using errcode = 'PWB01';
  end if;
  if v_documento is null or v_telefono is null then
    raise exception 'Faltan el documento o el telefono del cliente' using errcode = 'PWB11';
  end if;

  if p_medio is null or p_medio not in ('Transferencia', 'Tarjeta de débito', 'Tarjeta de crédito') then
    raise exception 'Medio de pago no disponible' using errcode = 'PWB02';
  end if;
  select mp.id_medio_pago into v_id_medio
  from public.medio_pago mp
  where mp.tipo::text = p_medio and mp.activo
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
