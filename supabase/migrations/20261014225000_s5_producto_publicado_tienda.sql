-- S5-2a (AO-01): publicar un articulo en la tienda online.
-- Columna aparte y funcion propia: fn_producto_modificar pisa precios con 0 (Problemas conocidos nº 7),
-- asi que publicar/despublicar no pasa por ella. No toca ninguna funcion existente.
alter table public.producto
  add column if not exists publicado_tienda boolean not null default false;

create or replace function public.fn_producto_publicar_tienda(p_id_producto uuid, p_publicado boolean)
returns public.producto
language plpgsql
set search_path = public
as $$
declare
  v_producto public.producto;
begin
  if p_publicado is null then
    raise exception 'Indicá si el artículo se publica o no en la tienda'
      using errcode = 'PRD10';
  end if;

  if not exists (select 1 from public.producto where id_producto = p_id_producto) then
    raise exception 'No se encontró el producto indicado'
      using errcode = 'PRD04';
  end if;

  update public.producto
  set publicado_tienda = p_publicado,
      editado = now()
  where id_producto = p_id_producto
  returning * into v_producto;

  return v_producto;
end;
$$;

revoke all on function public.fn_producto_publicar_tienda(uuid, boolean) from public, anon;
grant execute on function public.fn_producto_publicar_tienda(uuid, boolean) to authenticated;
