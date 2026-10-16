-- S5-15a (E-01): foto del articulo para la tienda online.
-- Columna producto.imagen_url (URL publica del bucket `productos`) + funcion propia para asignarla,
-- porque fn_producto_modificar pisa precios con 0 (Problemas conocidos n 7). No toca funciones existentes.
-- Storage: bucket publico `productos` (lectura abierta por URL); solo el personal del ERP escribe.
-- Errcodes: PRD04 (producto inexistente, ya existente), PRD11 (URL invalida).
-- Reversion: drop function fn_producto_asignar_imagen; alter table producto drop column imagen_url;
--            borrar politicas productos_* de storage.objects y el bucket.
alter table public.producto add column if not exists imagen_url text;

create or replace function public.fn_producto_asignar_imagen(p_id_producto uuid, p_imagen_url text)
returns text
language plpgsql
set search_path = public
as $$
declare
  v_url text := nullif(btrim(p_imagen_url), '');
begin
  if v_url is not null and (v_url !~* '^https://' or length(v_url) > 500) then
    raise exception 'La URL de la imagen no es valida' using errcode = 'PRD11';
  end if;

  update public.producto
  set imagen_url = v_url,
      editado = now()
  where id_producto = p_id_producto;

  if not found then
    raise exception 'No se encontró el producto indicado' using errcode = 'PRD04';
  end if;

  return v_url;
end;
$$;

revoke all on function public.fn_producto_asignar_imagen(uuid, text) from public, anon;
grant execute on function public.fn_producto_asignar_imagen(uuid, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('productos', 'productos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists productos_insert_personal on storage.objects;
drop policy if exists productos_update_personal on storage.objects;
drop policy if exists productos_delete_personal on storage.objects;

create policy productos_insert_personal on storage.objects
  for insert to authenticated
  with check (bucket_id = 'productos' and public.es_personal_erp());
create policy productos_update_personal on storage.objects
  for update to authenticated
  using (bucket_id = 'productos' and public.es_personal_erp())
  with check (bucket_id = 'productos' and public.es_personal_erp());
create policy productos_delete_personal on storage.objects
  for delete to authenticated
  using (bucket_id = 'productos' and public.es_personal_erp());
