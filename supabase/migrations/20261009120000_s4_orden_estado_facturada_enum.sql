-- Estado de una orden de compra ya vinculada a una factura y todavia sin recepcion.
-- El valor no se usa en esta transaccion.

alter type public.estado_orden_compra add value if not exists 'Facturada';
