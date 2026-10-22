-- S5-18g | Ventas del ERP muestran el canal y el mail del cliente.
--   fn_venta_obtener: suma 'mail_cliente' (resto del cuerpo, igual al vigente).
--   fn_venta_listar : devuelve 'canal' y acepta p_canal (canal_venta, default null).
--                     Cambia la firma (drop + create) con los mismos grants.

create or replace function public.fn_venta_obtener(p_id_comprobante uuid)
returns jsonb
language sql
stable
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'venta', jsonb_build_object(
      'id_comprobante', v.id_comprobante,
      'id_cliente', v.id_cliente,
      'nombre_cliente', c.nombre_cliente,
      'documento_cliente', c.documento_cliente,
      'telefono_cliente', c.telefono_cliente,
      'mail_cliente', c.mail_cliente,
      'direccion_cliente', c.direccion_cliente,
      'nombre_tipo_cliente', tcl.nombre_tipo_cliente,
      'id_tipo_comprobante', v.id_tipo_comprobante,
      'nombre_tipo_comprobante', tc.nombre_tipo_comprobante,
      'letra', tc.letra,
      'punto_venta', v.punto_venta,
      'numero', v.numero,
      'numero_formateado', lpad(v.punto_venta::text, 5, '0') || '-' || lpad(v.numero::text, 8, '0'),
      'fecha_comprobante', v.fecha_comprobante,
      'canal', v.canal,
      'tipo_venta', v.tipo_venta,
      'id_caja', v.id_caja,
      'subtotal', v.subtotal,
      'descuento_total', v.descuento_total,
      'descuento_porcentaje', v.descuento_porcentaje,
      'id_lista_precio', v.id_lista_precio,
      'nombre_lista_precio', lp.nombre_lista_precio,
      'importe_total', v.importe_total,
      'saldo_pendiente', v.saldo_pendiente,
      'observaciones', v.observaciones,
      'estado', v.estado,
      'fecha_despacho', v.fecha_despacho,
      'creado', v.creado,
      'creado_por', v.creado_por,
      'creado_por_nombre', coalesce(u.nombre_completo, 'Usuario no disponible')
    ),
    'detalle', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id_detalle', d.id_detalle,
        'nro_linea', d.nro_linea,
        'id_producto', d.id_producto,
        'codigo_producto', p.codigo_producto,
        'nombre_completo', p.nombre_producto || ' - ' || m.nombre_marca || ' (' || p.numero_medida || ' ' || um.abreviatura || ')',
        'id_deposito', d.id_deposito,
        'nombre_deposito', dep.nombre_deposito,
        'cantidad', d.cantidad,
        'precio_unitario', d.precio_unitario,
        'descuento', d.descuento,
        'importe_linea', d.importe_linea,
        'id_movimiento', d.id_movimiento
      ) order by d.nro_linea)
      from public.comprobante_venta_detalle d
      join public.producto p on p.id_producto = d.id_producto
      join public.marca m on m.id_marca = p.id_marca
      join public.unidad_medida um on um.id_unidad_medida = p.id_unidad_medida
      join public.deposito dep on dep.id_deposito = d.id_deposito
      where d.id_comprobante = v.id_comprobante
    ), '[]'::jsonb),
    'cobro', (
      select jsonb_build_object(
        'id_cobro', cb.id_cobro,
        'fecha_cobro', cb.fecha_cobro,
        'importe_total', cb.importe_total,
        'creado_por_nombre', coalesce(uc.nombre_completo, 'Usuario no disponible'),
        'medios', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', cm.id,
            'nombre_medio_pago', mp.nombre_medio_pago,
            'nombre_cuenta', ct.nombre_cuenta,
            'referencia', cm.referencia,
            'importe', cm.importe
          ) order by mp.nombre_medio_pago)
          from public.cobro_medio cm
          join public.medio_pago mp on mp.id_medio_pago = cm.id_medio_pago
          join public.cuenta_tesoreria ct on ct.id_cuenta = cm.id_cuenta_tesoreria
          where cm.id_cobro = cb.id_cobro
        ), '[]'::jsonb)
      )
      from public.cobro cb
      left join public.vw_usuario_resumen uc on uc.id_usuario = cb.creado_por
      where cb.id_comprobante = v.id_comprobante
    ),
    'cobro_caja', (
      select jsonb_agg(jsonb_build_object(
        'id_movimiento_caja', mc.id_movimiento_caja,
        'nombre_medio_pago', mp.nombre_medio_pago,
        'tipo_medio', mp.tipo,
        'importe', mc.importe,
        'referencia', mc.referencia,
        'nombre_cuenta', ct.nombre_cuenta,
        'creado', mc.creado,
        'creado_por_nombre', coalesce(umc.nombre_completo, 'Usuario no disponible')
      ) order by mc.creado)
      from public.movimiento_caja mc
      join public.medio_pago mp on mp.id_medio_pago = mc.id_medio_pago
      left join public.vw_usuario_resumen umc on umc.id_usuario = mc.creado_por
      left join public.movimiento_tesoreria mt on mt.id_movimiento_caja = mc.id_movimiento_caja
      left join public.cuenta_tesoreria ct on ct.id_cuenta = mt.id_cuenta_tesoreria
      where mc.id_comprobante = v.id_comprobante
    )
  )
  from public.comprobante_venta v
  join public.cliente c on c.id_cliente = v.id_cliente
  join public.tipo_cliente tcl on tcl.id_tipo_cliente = c.id_tipo_cliente
  join public.tipo_comprobante tc on tc.id_tipo_comprobante = v.id_tipo_comprobante
  left join public.lista_precio lp on lp.id_lista_precio = v.id_lista_precio
  left join public.vw_usuario_resumen u on u.id_usuario = v.creado_por
  where v.id_comprobante = p_id_comprobante;
$function$;

drop function if exists public.fn_venta_listar(uuid, date, date, public.estado_venta, public.tipo_venta);

create function public.fn_venta_listar(
  p_id_cliente uuid default null,
  p_desde date default null,
  p_hasta date default null,
  p_estado public.estado_venta default null,
  p_tipo_venta public.tipo_venta default null,
  p_canal public.canal_venta default null
)
returns table(
  id_comprobante uuid, id_cliente uuid, nombre_cliente text, id_tipo_comprobante uuid,
  nombre_tipo_comprobante text, letra character, punto_venta integer, numero integer,
  numero_formateado text, fecha_comprobante date, tipo_venta public.tipo_venta,
  canal public.canal_venta, importe_total numeric, saldo_pendiente numeric,
  estado public.estado_venta, cantidad_articulos bigint, id_cobro uuid, id_caja uuid,
  creado timestamp with time zone, creado_por uuid, creado_por_nombre text
)
language sql
stable
set search_path to 'public'
as $function$
  select
    v.id_comprobante,
    v.id_cliente,
    c.nombre_cliente,
    v.id_tipo_comprobante,
    tc.nombre_tipo_comprobante,
    tc.letra,
    v.punto_venta,
    v.numero,
    lpad(v.punto_venta::text, 5, '0') || '-' || lpad(v.numero::text, 8, '0') as numero_formateado,
    v.fecha_comprobante,
    v.tipo_venta,
    v.canal,
    v.importe_total,
    v.saldo_pendiente,
    v.estado,
    (select count(*) from public.comprobante_venta_detalle d where d.id_comprobante = v.id_comprobante) as cantidad_articulos,
    cb.id_cobro,
    v.id_caja,
    v.creado,
    v.creado_por,
    coalesce(u.nombre_completo, 'Usuario no disponible') as creado_por_nombre
  from public.comprobante_venta v
  join public.cliente c on c.id_cliente = v.id_cliente
  join public.tipo_comprobante tc on tc.id_tipo_comprobante = v.id_tipo_comprobante
  left join public.cobro cb on cb.id_comprobante = v.id_comprobante
  left join public.vw_usuario_resumen u on u.id_usuario = v.creado_por
  where (p_id_cliente is null or v.id_cliente = p_id_cliente)
    and (p_desde is null or v.fecha_comprobante >= p_desde)
    and (p_hasta is null or v.fecha_comprobante <= p_hasta)
    and (p_estado is null or v.estado = p_estado)
    and (p_tipo_venta is null or v.tipo_venta = p_tipo_venta)
    and (p_canal is null or v.canal = p_canal)
  order by v.fecha_comprobante desc, v.creado desc;
$function$;

revoke execute on function public.fn_venta_listar(uuid, date, date, public.estado_venta, public.tipo_venta, public.canal_venta) from public, anon;
grant execute on function public.fn_venta_listar(uuid, date, date, public.estado_venta, public.tipo_venta, public.canal_venta) to authenticated, service_role;
