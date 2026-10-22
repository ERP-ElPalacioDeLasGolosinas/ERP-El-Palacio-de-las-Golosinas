-- S5-18h (D-034): fn_pedido_web_confirmar_pago_interno fallaba (23503) cuando paga un cliente web:
-- movimiento_stock.creado_por es NOT NULL con FK a usuario (personal) y el cliente web no esta ahi.
-- Cambio unico: la "Salida por venta" se registra con v_autor = auth.uid() si es personal del ERP; si no,
-- con el usuario configurado en tienda_parametro 'usuario_stock_tienda' (id de usuario del personal).
-- comprobante_venta, cobro y movimiento_tesoreria siguen usando auth.uid() (no tienen FK).
-- Falla con PWB08 si el parametro falta o no apunta a un usuario. El resto del cuerpo no cambia.
-- Reversion: restaurar el cuerpo desde 20261020110000 y borrar la clave 'usuario_stock_tienda'.

insert into public.tienda_parametro (clave, valor)
values ('usuario_stock_tienda', '0118bc8f-89bb-48af-a668-fa9d8dc58829')
on conflict (clave) do nothing;

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
  ) st on true
  where coalesce(st.disp, 0) < t.cant;
  if v_falta is not null then
    raise exception 'Stock insuficiente al confirmar el pago: %', v_falta using errcode = 'PWB06';
  end if;

  select * into v_cli from public.cliente where cliente.id_cliente = v_ped.id_cliente;

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
    v_ped.subtotal, 0, v_ped.importe_total, v_ped.importe_total,
    v_lista.id_lista_precio, 0, 'Consumidor final',
    'Pedido web ' || v_ped.numero
      || ' · ' || coalesce(nullif(btrim(v_cli.nombre_cliente), ''), '-')
      || ' · ' || coalesce(nullif(btrim(v_cli.documento_cliente), ''), '-')
      || ' · ' || coalesce(nullif(btrim(v_cli.telefono_cliente), ''), '-')
      || ' · ' || coalesce(nullif(btrim(v_cli.mail_cliente), ''), '-')
      || ' · ' || coalesce(nullif(btrim(v_cli.direccion_cliente), ''), '-'),
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

  -- cobro: fn_cobro_registrar exige venta 'Despachado' y la deja 'Pagado'. El estado logistico
  -- del pedido lo lleva pedido_web.estado.
  update public.comprobante_venta set estado = 'Despachado' where comprobante_venta.id_comprobante = v_venta.id_comprobante;
  perform public.fn_cobro_registrar(
    v_venta.id_comprobante, current_date, 'Pedido web ' || v_ped.numero,
    jsonb_build_array(jsonb_build_object(
      'id_medio_pago', v_ped.id_medio_pago, 'id_cuenta_tesoreria', v_cuenta,
      'importe', v_ped.importe_total, 'referencia', p_referencia)),
    v_uid);

  update public.pedido_web
  set estado = 'Pagado', id_comprobante = v_venta.id_comprobante, fecha_pago = now()
  where pedido_web.id_pedido = v_ped.id_pedido;

  return query select v_ped.id_pedido, v_venta.id_comprobante, false;
end;
$function$;

revoke all on function public.fn_pedido_web_confirmar_pago_interno(uuid, text) from public, anon, authenticated, service_role;
