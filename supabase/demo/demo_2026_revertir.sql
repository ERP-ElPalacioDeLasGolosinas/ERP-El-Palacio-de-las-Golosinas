-- =====================================================================
-- Revierte la carga de demo_2026_carga.sql
--
-- Borra todas las filas anotadas en demo_seed.registro (y sus detalles),
-- devuelve el stock y los saldos de tesorería que movieron, y deja el
-- esquema demo_seed para poder volver a cargar.
--
--   select demo_seed.revertir();         -- deshace la carga
--   drop schema demo_seed cascade;        -- opcional, al final
--
-- Limitación: si después de la carga alguien registró una venta que
-- consumió un lote creado por la carga, esa venta queda apuntando a un lote
-- inexistente y el borrado falla por clave foránea (no se borra nada).
-- =====================================================================

create or replace function demo_seed.revertir()
returns table(concepto text, valor text) language plpgsql as $$
declare
  v_tablas text[] := array['comprobante_venta', 'comprobante_venta_detalle', 'cobro', 'cobro_medio',
                           'movimiento_tesoreria', 'movimiento_caja', 'arqueo_caja', 'caja', 'sesion_caja',
                           'pago', 'pago_medio', 'pago_comprobante', 'pago_nota_credito', 'cheque',
                           'orden_pago', 'orden_pago_comprobante', 'orden_pago_medio', 'orden_pago_nota_credito',
                           'nota_credito_proveedor', 'nota_credito_proveedor_detalle',
                           'nota_debito_proveedor', 'nota_debito_proveedor_detalle',
                           'inventario', 'inventario_producto', 'comprobante_proveedor', 'comprobante_proveedor_detalle',
                           'orden_compra', 'orden_compra_detalle', 'movimiento_stock', 'movimiento_stock_detalle',
                           'lista_precio', 'lista_precio_detalle', 'cliente', 'tipo_movimiento', 'stock'];
  t text;
begin
  create temp table _v  on commit drop as select id from demo_seed.registro where tabla = 'comprobante_venta';
  create temp table _ms on commit drop as select id from demo_seed.registro where tabla = 'movimiento_stock';
  create temp table _mt on commit drop as select id from demo_seed.registro where tabla = 'movimiento_tesoreria';
  create temp table _cb on commit drop as select id from demo_seed.registro where tabla = 'cobro';
  create temp table _cp on commit drop as select id from demo_seed.registro where tabla = 'comprobante_proveedor';
  create temp table _oc on commit drop as select id from demo_seed.registro where tabla = 'orden_compra';
  create temp table _lt on commit drop as select id from demo_seed.registro where tabla = 'inventario';
  create temp table _op on commit drop as select id from demo_seed.registro where tabla = 'orden_pago';
  create temp table _pg on commit drop as select id from demo_seed.registro where tabla = 'pago';
  create temp table _cj on commit drop as select id from demo_seed.registro where tabla = 'caja_apertura';

  foreach t in array v_tablas loop
    perform demo_seed._triggers(t, false);
  end loop;

  -- Stock: deshacer cada movimiento de la carga
  update public.stock s
  set cantidad = s.cantidad - x.neto, editado = now()
  from (
    select m.id_producto, m.id_deposito, sum(tm.signo * m.cantidad) as neto
    from public.movimiento_stock m
    join public.tipo_movimiento tm on tm.id_tipo_movimiento = m.id_tipo_movimiento
    where m.id_movimiento in (select id from _ms)
    group by 1, 2
  ) x
  where s.id_producto = x.id_producto and s.id_deposito = x.id_deposito;

  -- Lotes previos a la carga que las ventas de la carga consumieron
  update public.inventario_producto ip
  set stock_disponible = ip.stock_disponible + x.cantidad
  from (
    select d.id_inventario_producto, sum(d.cantidad_aplicada) as cantidad
    from public.movimiento_stock_detalle d
    where d.id_movimiento in (select id from _ms)
    group by 1
  ) x
  where ip.id_inventario_producto = x.id_inventario_producto
    and ip.id_inventario not in (select id from _lt);

  -- Tesorería
  update public.cuenta_tesoreria c
  set saldo_actual = round(c.saldo_actual - x.neto, 2)
  from (
    select id_cuenta_tesoreria, sum(case when tipo = 'Ingreso' then importe else -importe end) as neto
    from public.movimiento_tesoreria where id_movimiento in (select id from _mt)
    group by 1
  ) x
  where c.id_cuenta = x.id_cuenta_tesoreria;

  -- Ventas, cobros y cajas
  delete from public.movimiento_tesoreria where id_movimiento in (select id from _mt);
  delete from public.cobro_medio where id_cobro in (select id from _cb);
  delete from public.cobro where id_cobro in (select id from _cb);
  delete from public.comprobante_venta_detalle where id_comprobante in (select id from _v);
  delete from public.movimiento_caja where id_caja in (select id from _cj);
  delete from public.sesion_caja where id_caja in (select id from _cj);
  delete from public.comprobante_venta where id_comprobante in (select id from _v);
  -- caja y arqueo_caja se referencian entre sí: se borran en la misma sentencia
  with a as (delete from public.arqueo_caja where id_caja in (select id from _cj))
  delete from public.caja where id_caja in (select id from _cj);

  -- Pagos y órdenes de pago
  delete from public.cheque where id_pago_medio in (select id from public.pago_medio where id_pago in (select id from _pg));
  delete from public.pago_medio where id_pago in (select id from _pg);
  delete from public.pago_comprobante where id_pago in (select id from _pg);
  delete from public.pago_nota_credito where id_pago in (select id from _pg);
  delete from public.pago where id_pago in (select id from _pg);
  delete from public.orden_pago_comprobante where id_orden_pago in (select id from _op);
  delete from public.orden_pago_medio where id_orden_pago in (select id from _op);
  delete from public.orden_pago_nota_credito where id_orden_pago in (select id from _op);
  delete from public.orden_pago where id_orden_pago in (select id from _op);

  -- Compras, notas y lotes
  delete from public.nota_credito_proveedor_detalle where id_comprobante in (select id from _cp);
  delete from public.nota_credito_proveedor where id_comprobante in (select id from _cp);
  delete from public.nota_debito_proveedor_detalle where id_comprobante in (select id from _cp);
  delete from public.nota_debito_proveedor where id_comprobante in (select id from _cp);
  delete from public.movimiento_stock_detalle where id_movimiento in (select id from _ms);
  delete from public.inventario_producto where id_inventario in (select id from _lt);
  delete from public.inventario where id_lote in (select id from _lt);
  delete from public.comprobante_proveedor_detalle where id_comprobante in (select id from _cp);
  delete from public.comprobante_proveedor where id_comprobante in (select id from _cp);
  delete from public.orden_compra_detalle where id_orden_compra in (select id from _oc);
  delete from public.orden_compra where id_orden_compra in (select id from _oc);
  delete from public.movimiento_stock where id_movimiento in (select id from _ms);

  -- Catálogos creados por la carga
  delete from public.lista_precio_detalle where id_lista_precio in (select id from demo_seed.registro where tabla = 'lista_precio');
  delete from public.lista_precio where id_lista_precio in (select id from demo_seed.registro where tabla = 'lista_precio');
  delete from public.cliente where id_cliente in (select id from demo_seed.registro where tabla = 'cliente');
  delete from public.tipo_movimiento where id_tipo_movimiento in (select id from demo_seed.registro where tabla = 'tipo_movimiento');

  foreach t in array v_tablas loop
    perform demo_seed._triggers(t, true);
  end loop;

  truncate demo_seed.registro, demo_seed.pendiente, demo_seed.mes_cargado, demo_seed.proveedor_marca,
           demo_seed.proveedor_perfil, demo_seed.cliente_perfil;

  return query
  select 'Stock distinto de la foto previa (filas)', count(*)::text
  from demo_seed.snapshot_stock sn
  join public.stock s using (id_producto, id_deposito)
  where s.cantidad <> sn.cantidad
  union all
  select 'Cuenta ' || c.nombre_cuenta, to_char(c.saldo_actual, 'FM999G999G990D00') || ' (antes ' || to_char(sn.saldo_actual, 'FM999G999G990D00') || ')'
  from public.cuenta_tesoreria c join demo_seed.snapshot_cuenta sn using (id_cuenta);

  delete from demo_seed.parametro;
  truncate demo_seed.snapshot_stock, demo_seed.snapshot_cuenta;
end;
$$;
