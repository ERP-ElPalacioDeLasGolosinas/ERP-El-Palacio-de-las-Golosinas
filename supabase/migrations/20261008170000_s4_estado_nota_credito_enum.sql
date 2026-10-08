-- La nota de credito se acredita al registrarse. "Pendiente" es un estado
-- de pago y no le corresponde. El valor nuevo no se puede usar en esta
-- misma transaccion.

alter type public.estado_comprobante_proveedor add value if not exists 'Confirmada';
