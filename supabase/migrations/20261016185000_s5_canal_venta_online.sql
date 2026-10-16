-- S5-6b (E-05): el comprobante de un pedido web se registra con canal 'Online'.
-- Aditiva: agrega un valor al enum canal_venta (hoy solo 'Presencial'). Ninguna funcion lo compara.
-- Va en migracion aparte: el valor nuevo no se puede usar en la misma transaccion que lo crea.
-- Reversion: no se puede quitar un valor de un enum; basta con no usarlo.
alter type public.canal_venta add value if not exists 'Online';
