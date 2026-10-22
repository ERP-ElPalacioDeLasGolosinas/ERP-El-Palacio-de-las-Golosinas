-- S5-19c · fn_pedido_web_registrar con entrega (envío a domicilio o retiro por sucursal).
--
-- Cambios respecto de 20261020120000:
--  * Firma nueva: se agregan p_tipo_entrega, datos de envío y p_id_deposito_retiro (todos con default
--    null; la función los valida). Se elimina la firma de 2 argumentos (sin dependientes).
--  * 'Envío a domicilio': exige destinatario, dirección y localidad (PWB14); suma
--    tienda_parametro.costo_envio al total y lo guarda en pedido_web.costo_envio.
--  * 'Retiro por sucursal': exige una sucursal de fn_tienda_sucursales_retiro (stock para todo el
--    carrito); si no califica, PWB15. Costo de envío 0.
--  * Otro tipo o null: PWB13.
--  * subtotal = suma de líneas; importe_total = subtotal + costo_envio.
-- Resto del cuerpo (cliente, documento/teléfono, medio, validación de carrito) sin cambios.
-- Errcodes: PWB01…PWB04, PWB11 (como antes), PWB02 medio, PWB13 entrega inválida, PWB14 faltan datos
-- de envío, PWB15 sucursal de retiro no válida.

drop function if exists public.fn_pedido_web_registrar(jsonb, text);

create or replace function public.fn_pedido_web_registrar(
  p_items jsonb,
  p_medio text,
  p_tipo_entrega text default null,
  p_envio_destinatario text default null,
  p_envio_direccion text default null,
  p_envio_localidad text default null,
  p_envio_observaciones text default null,
  p_id_deposito_retiro uuid default null
)
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
  v_subtotal numeric(14,2);
  v_costo_envio numeric(12,2) := 0;
  v_total numeric(14,2);
  v_malas text;
  v_lineas jsonb;
  v_destinatario text := nullif(btrim(p_envio_destinatario), '');
  v_direccion text := nullif(btrim(p_envio_direccion), '');
  v_localidad text := nullif(btrim(p_envio_localidad), '');
  v_observaciones text := nullif(btrim(p_envio_observaciones), '');
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

  if p_tipo_entrega is null or p_tipo_entrega not in ('Envío a domicilio', 'Retiro por sucursal') then
    raise exception 'Tipo de entrega invalido' using errcode = 'PWB13';
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

  if p_tipo_entrega = 'Envío a domicilio' then
    if v_destinatario is null or v_direccion is null or v_localidad is null then
      raise exception 'Faltan datos de envio' using errcode = 'PWB14';
    end if;
    select coalesce(nullif(btrim(tp.valor), '')::numeric, 0) into v_costo_envio
    from public.tienda_parametro tp
    where tp.clave = 'costo_envio';
    v_costo_envio := coalesce(v_costo_envio, 0);
    p_id_deposito_retiro := null;
  else
    if p_id_deposito_retiro is null or not exists (
      select 1
      from public.fn_tienda_sucursales_retiro(
        (select jsonb_agg(jsonb_build_object('id_producto', l.id_producto, 'cantidad', l.cantidad))
         from jsonb_to_recordset(v_lineas) as l(id_producto uuid, cantidad numeric, precio numeric, estado text))
      ) s
      where s.id_deposito = p_id_deposito_retiro
    ) then
      raise exception 'Sucursal de retiro no valida para este pedido' using errcode = 'PWB15';
    end if;
    v_destinatario := null;
    v_direccion := null;
    v_localidad := null;
    v_observaciones := null;
  end if;

  select sum(round(l.cantidad * l.precio, 2)) into v_subtotal
  from jsonb_to_recordset(v_lineas) as l(id_producto uuid, cantidad numeric, precio numeric, estado text);
  v_total := v_subtotal + v_costo_envio;

  insert into public.pedido_web (
    id_cliente, id_medio_pago, subtotal, importe_total,
    tipo_entrega, costo_envio, envio_destinatario, envio_direccion, envio_localidad,
    envio_observaciones, id_deposito_retiro
  )
  values (
    v_id_cliente, v_id_medio, v_subtotal, v_total,
    p_tipo_entrega::public.tipo_entrega_pedido, v_costo_envio, v_destinatario, v_direccion,
    v_localidad, v_observaciones, p_id_deposito_retiro
  )
  returning pedido_web.id_pedido, pedido_web.numero into v_id_pedido, v_numero;

  insert into public.pedido_web_detalle (id_pedido, nro_linea, id_producto, cantidad, precio_unitario)
  select v_id_pedido, row_number() over (order by l.id_producto), l.id_producto, l.cantidad, l.precio
  from jsonb_to_recordset(v_lineas) as l(id_producto uuid, cantidad numeric, precio numeric, estado text);

  return query select v_id_pedido, v_numero, v_total;
end;
$function$;

revoke all on function public.fn_pedido_web_registrar(jsonb, text, text, text, text, text, text, uuid) from public;
grant execute on function public.fn_pedido_web_registrar(jsonb, text, text, text, text, text, text, uuid)
  to authenticated, service_role;
