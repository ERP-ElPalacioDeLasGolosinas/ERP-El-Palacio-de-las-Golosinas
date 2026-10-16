-- S5-15d: el ERP lista la carpeta de un articulo en el bucket `productos` para borrar fotos viejas
-- (storage.list necesita SELECT sobre storage.objects). Solo personal del ERP; la lectura publica
-- por URL del bucket no cambia. Reversion: drop policy productos_select_personal on storage.objects.
drop policy if exists productos_select_personal on storage.objects;
create policy productos_select_personal on storage.objects
  for select to authenticated
  using (bucket_id = 'productos' and public.es_personal_erp());
