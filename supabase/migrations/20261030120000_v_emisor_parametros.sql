-- V-comprobante imprimible: datos del emisor para el encabezado del comprobante de venta.
-- Mismas reglas que tienda_parametro (clave/valor, RLS solo personal). Valores vacios hasta que
-- el negocio los cargue; el comprobante muestra un guion mientras esten vacios.
-- Aditiva: solo inserta filas. Reversion: delete from public.tienda_parametro where clave like 'emisor\_%';
insert into public.tienda_parametro (clave) values
  ('emisor_razon_social'), ('emisor_cuit'), ('emisor_domicilio'), ('emisor_telefono')
on conflict (clave) do nothing;

comment on table public.tienda_parametro is
  'Parametros de la tienda online (clave/valor). transferencia_*: datos bancarios de E-05. emisor_*: datos del emisor en el comprobante de venta imprimible.';
