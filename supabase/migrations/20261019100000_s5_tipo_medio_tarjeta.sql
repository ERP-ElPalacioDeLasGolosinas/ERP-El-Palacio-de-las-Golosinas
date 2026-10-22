-- S5-18b: la tienda acepta pagos con tarjeta (pasarela simulada, S5-18).
-- Aditiva: agrega dos valores al enum tipo_medio_pago. Ninguna funcion existente cambia.
-- Va en migracion aparte: el valor nuevo no se puede usar en la misma transaccion que lo crea
-- (el seed de medio_pago va en S5-18c).
-- Reversion: no se puede quitar un valor de un enum; basta con no usarlo.
alter type public.tipo_medio_pago add value if not exists 'Tarjeta de débito';
alter type public.tipo_medio_pago add value if not exists 'Tarjeta de crédito';
