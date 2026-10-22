-- S5-19d (D-035): fn_pedido_web_confirmar_pago_interno con entrega.
-- Cambios sobre 20261021100000 (el resto del cuerpo no cambia):
--  * Retiro por sucursal: el stock se valida y descuenta solo del deposito pedido_web.id_deposito_retiro
--    (PWB06 si ese deposito no cubre el pedido). Envio a domicilio / pedidos previos (tipo_entrega NULL):
--    se mantiene el reparto actual entre depositos activos.
--  * comprobante_venta: subtotal = importe_total del pedido (incluye el costo de envio, porque
--    chk_comprobante_venta_total exige importe_total = subtotal - descuento_total); las lineas de detalle
--    suman solo los productos. observaciones suma la entrega (destinatario/direccion/localidad o sucursal).
--  * D-035: tras registrar el cobro (que exige 'Despachado' y deja 'Pagado') la venta vuelve a
--    'En preparacion'; queda con saldo_pendiente 0. Pasa a 'Despachado' al despachar/retirar (S5-19f).
-- Reversion: restaurar el cuerpo desde 20261021100000_s5_confirmar_pago_interno_autor_stock.sql.

create or replace function public.fn_pedido_web_confirmar_pago_interno(
  p_id uuid,
  p_referencia text default null
)
returns table(id_pedido uuid, id_comprobante uuid, ya_confirmado boolean)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_ped        public.pedido_web;
  v_cli        public.cliente;
  v_uid        uuid := auth.uid();
  v_autor      uuid;
  v_tipo_comp  uuid;
  v_lista      public.lista_precio;
  v_tipo_mov   uuid;
  v_venta      public.comprobante_venta;
  v_numero     integer;
  v_remito     text;
  v_cuenta     uuid;
  v_dep        uuid;
  v_entrega    text;
  v_falta      text;
  v_pend       numeric;
  v_toma       numeric;
  v_linea      integer := 0;
  v_mov        public.movimiento_stock;
  v_id_det     uuid;
  d            record;
  s            record;
begin
  select * into v_ped from public.pedido_web where pedido_web.id_pedido = p_id for update;
  if v_ped.id_pedido is null then
    raise exception 'El pedido indicado no existe' using errcode = 'PWB05';
  end if;

  if v_ped.id_comprobante is not null then
    return query select v_ped.id_pedido, v_ped.id_comprobante, true;
    return;
  end if;
  if v_ped.estado <> 'Pendiente de pago' then
    raise exception 'El pedido esta % y no admite confirmar el pago', v_ped.estado using errcode = 'PWB05';
  end if;

  -- configuracion necesaria
  select tc.id_tipo_comprobante into v_tipo_comp
  from public.tipo_comprobante tc
  where tc.aplica_venta and tc.activo and tc.clase = 'factura'
  order by (lower(btrim(tc.nombre_tipo_comprobante)) = 'factura b') desc, tc.nombre_tipo_comprobante
  limit 1;
  if v_tipo_comp is null then
    raise exception 'No hay un tipo de comprobante de venta (factura) activo' using errcode = 'PWB08';
  end if;

  select id_tipo_movimiento into v_tipo_mov
  from public.tipo_movimiento
  where lower(btrim(nombre)) = 'salida por venta' and activo = true;
  if v_tipo_mov is null then
    raise exception 'No existe el tipo de movimiento "Salida por venta" activo' using errcode = 'PWB08';
  end if;

  if exists (select 1 from public.usuario u where u.id_usuario = v_uid) then
    v_autor := v_uid;
  else
    select u.id_usuario into v_autor
    from public.tienda_parametro tp
    join public.usuario u on u.id_usuario::text = nullif(btrim(tp.valor), '')
    where tp.clave = 'usuario_stock_tienda';
    if v_autor is null then
      raise exception 'Falta configurar el usuario de stock de la tienda' using errcode = 'PWB08';
    end if;
  end if;

  select * into v_lista from public.fn_lista_precio_vigente('Minorista', current_date) limit 1;

  -- cuenta receptora: la configura Tesoreria para la tienda (tienda_parametro)
  select nullif(btrim(tp.valor), '')::uuid into v_cuenta
  from public.tienda_parametro tp where tp.clave = 'cuenta_tesoreria_tienda';
  if v_cuenta is null or not exists (
    select 1 from public.medio_pago_cuenta mpc
    join public.cuenta_tesoreria ct on ct.id_cuenta = mpc.id_cuenta_tesoreria and ct.activo
    where mpc.id_medio_pago = v_ped.id_medio_pago and mpc.id_cuenta_tesoreria = v_cuenta
  ) then
    raise exception 'Tesoreria no configuro una cuenta activa para recibir los pagos de la tienda'
      using errcode = 'PWB07';
  end if;

  select string_agg(p.nombre_producto || ' (disponible ' || coalesce(st.disp, 0) || ', pedido ' || t.cant || ')', ', ')
    into v_falta
  from (
    select pd.id_producto, sum(pd.cantidad) as cant
    from public.pedido_web_detalle pd where pd.id_pedido = v_ped.id_pedido group by pd.id_producto
  ) t
  join public.producto p on p.id_producto = t.id_producto
  left join lateral (
    select sum(s2.cantidad) as disp
    from public.stock s2 join public.deposito dp on dp.id_deposito = s2.id_deposito and dp.activo
    where s2.id_producto = t.id_producto
      and (v_ped.tipo_entrega is distinct from 'Retiro por sucursal' or s2.id_deposito = v_ped.id_deposito_retiro)
  ) st on true
  where coalesce(st.disp, 0) < t.cant;
  if v_falta is not null then
    raise exception 'Stock insuficiente al confirmar el pago: %', v_falta using errcode = 'PWB06';
  end if;

  select * into v_cli from public.cliente where cliente.id_cliente = v_ped.id_cliente;

  if v_ped.tipo_entrega = 'Retiro por sucursal' then
    v_dep := v_ped.id_deposito_retiro;
    select 'Retiro en sucursal ' || dp.nombre_deposito into v_entrega
    from public.deposito dp where dp.id_deposito = v_dep and dp.activo;
    if v_entrega is null then
      raise exception 'La sucursal de retiro no existe o esta inactiva' using errcode = 'PWB06';
    end if;
  elsif v_ped.tipo_entrega = 'Envío a domicilio' then
    v_entrega := 'Envio a domicilio: ' || v_ped.envio_destinatario || ', ' || v_ped.envio_direccion
      || ', ' || v_ped.envio_localidad
      || coalesce(' (' || nullif(btrim(v_ped.envio_observaciones), '') || ')', '');
  end if;

  -- comprobante
  perform pg_advisory_xact_lock(hashtext('comprobante_venta:' || v_tipo_comp::text || ':1'));
  select coalesce(max(cv.numero), 0) + 1 into v_numero
  from public.comprobante_venta cv
  where cv.id_tipo_comprobante = v_tipo_comp and cv.punto_venta = 1;

  insert into public.comprobante_venta (
    id_cliente, id_tipo_comprobante, punto_venta, numero, fecha_comprobante, canal,
    subtotal, descuento_total, importe_total, saldo_pendiente,
    id_lista_precio, descuento_porcentaje, tipo_venta, observaciones, estado, creado_por
  ) values (
    v_ped.id_cliente, v_tipo_comp, 1, v_numero, current_date, 'Online',
    v_ped.importe_total, 0, v_ped.importe_total, v_ped.importe_total,
    v_lista.id_lista_precio, 0, 'Consumidor final',
    'Pedido web ' || v_ped.numero
      || ' · ' || coalesce(nullif(btrim(v_cli.nombre_cliente), ''), '-')
      || ' · ' || coalesce(nullif(btrim(v_cli.documento_cliente), ''), '-')
      || ' · ' || coalesce(nullif(btrim(v_cli.telefono_cliente), ''), '-')
      || ' · ' || coalesce(nullif(btrim(v_cli.mail_cliente), ''), '-')
      || ' · ' || coalesce(nullif(btrim(v_cli.direccion_cliente), ''), '-')
      || coalesce(' · ' || v_entrega, ''),
    'En preparación', v_uid
  ) returning * into v_venta;

  v_remito := 'Venta ' || lpad(v_venta.punto_venta::text, 5, '0') || '-' || lpad(v_venta.numero::text, 8, '0');

  -- detalle + salida de stock: una linea por (articulo, deposito), de mayor a menor stock
  for d in
    select pd.id_producto, pd.cantidad, pd.precio_unitario
    from public.pedido_web_detalle pd where pd.id_pedido = v_ped.id_pedido order by pd.nro_linea
  loop
    v_pend := d.cantidad;
    for s in
      select s2.id_deposito, s2.cantidad
      from public.stock s2 join public.deposito dp on dp.id_deposito = s2.id_deposito and dp.activo
      where s2.id_producto = d.id_producto and s2.cantidad > 0
        and (v_dep is null or s2.id_deposito = v_dep)
      order by s2.cantidad desc, dp.nombre_deposito
    loop
      exit when v_pend <= 0;
      v_toma := least(v_pend, s.cantidad);
      v_linea := v_linea + 1;
      insert into public.comprobante_venta_detalle (
        id_comprobante, nro_linea, id_producto, id_deposito, cantidad, precio_unitario, descuento
      ) values (v_venta.id_comprobante, v_linea, d.id_producto, s.id_deposito, v_toma, d.precio_unitario, 0)
      returning id_detalle into v_id_det;

      v_mov := public.fn_movimiento_stock_registrar(
        v_tipo_mov, d.id_producto, s.id_deposito, v_toma, v_autor, current_date, v_remito, null);
      update public.comprobante_venta_detalle set id_movimiento = v_mov.id_movimiento where id_detalle = v_id_det;
      v_pend := v_pend - v_toma;
    end loop;
  end loop;

  -- cobro: fn_cobro_registrar exige venta 'Despachado' y la deja 'Pagado'; D-035: despues vuelve a
  -- 'En preparacion' (cobrada, saldo 0) hasta que el empleado despache o entregue el pedido.
  update public.comprobante_venta set estado = 'Despachado' where comprobante_venta.id_comprobante = v_venta.id_comprobante;
  perform public.fn_cobro_registrar(
    v_venta.id_comprobante, current_date, 'Pedido web ' || v_ped.numero,
    jsonb_build_array(jsonb_build_object(
      'id_medio_pago', v_ped.id_medio_pago, 'id_cuenta_tesoreria', v_cuenta,
      'importe', v_ped.importe_total, 'referencia', p_referencia)),
    v_uid);
  update public.comprobante_venta set estado = 'En preparación' where comprobante_venta.id_comprobante = v_venta.id_comprobante;

  update public.pedido_web
  set estado = 'Pagado', id_comprobante = v_venta.id_comprobante, fecha_pago = now()
  where pedido_web.id_pedido = v_ped.id_pedido;

  return query select v_ped.id_pedido, v_venta.id_comprobante, false;
end;
$function$;

revoke all on function public.fn_pedido_web_confirmar_pago_interno(uuid, text) from public, anon, authenticated, service_role;
