-- S5-3b (E-01): opciones de filtro del catalogo de la tienda.
-- Devuelve categorias, rubros y marcas que tienen al menos un producto activo y publicado.
-- SECURITY DEFINER: anon no puede leer categoria/rubro/marca (RLS sin politica para anon).
create or replace function public.fn_tienda_filtros_listar()
returns table(tipo text, id uuid, nombre text)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select 'categoria', c.id_categoria, c.nombre_categoria
  from public.categoria c
  where exists (select 1 from public.producto p
                where p.id_categoria = c.id_categoria and p.activo and p.publicado_tienda)
  union all
  select 'rubro', r.id_rubro, r.nombre_rubro
  from public.rubro r
  where exists (select 1 from public.producto p
                where p.id_rubro = r.id_rubro and p.activo and p.publicado_tienda)
  union all
  select 'marca', m.id_marca, m.nombre_marca
  from public.marca m
  where exists (select 1 from public.producto p
                where p.id_marca = m.id_marca and p.activo and p.publicado_tienda)
  order by 1, 3;
$function$;

revoke all on function public.fn_tienda_filtros_listar() from public;
grant execute on function public.fn_tienda_filtros_listar() to anon, authenticated, service_role;
