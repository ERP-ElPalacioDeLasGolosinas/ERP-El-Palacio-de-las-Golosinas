-- S4 · V-15 · Mercado Pago (simulado) como tipo de medio de pago no efectivo.
-- Va sola: un valor nuevo de enum no puede usarse en la misma transacción que lo agrega.

alter type public.tipo_medio_pago add value if not exists 'Mercado Pago';
