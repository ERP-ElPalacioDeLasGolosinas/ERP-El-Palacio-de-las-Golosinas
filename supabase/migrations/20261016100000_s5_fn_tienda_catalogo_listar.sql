-- S5-3a (E-01): catalogo publico de la tienda online.
-- Solo productos activos y publicados que tengan precio en la lista Minorista vigente.
-- stock_disponible = suma de stock.cantidad en depositos activos. Paginado de 24 en 24.
-- SECURITY DEFINER con minimas columnas: anon no tiene acceso directo a las tablas.
create or replace function public.fn_tienda_catalogo_listar(
  p_busqueda text default null,
  p_id_categoria uuid default null,
  p_id_rubro uuid default null,
  p_id_marca uuid default null,
  p_pagina integer default 1
)
returns table(
  id_producto uuid,
  nombre_producto text,
  nombre_marca text,
  presentacion text,
  nombre_categoria text,
  nombre_rubro text,
  precio numeric,
  stock_disponible numeric,
  total_resultados bigint
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with lista as (
    select l.id_lista_precio
    from public.lista_precio l
    where l.tipo_lista = 'Minorista'
      and current_date between l.fecha_inicio and coalesce(l.fecha_fin, 'infinity'::date)
    limit 1
  ),
  base as (
    select
      p.id_producto,
      p.nombre_producto,
      m.nombre_marca,
      p.numero_medida || ' ' || um.abreviatura as presentacion,
      c.nombre_categoria,
      r.nombre_rubro,
      lpd.precio,
      coalesce((
        select sum(s.cantidad)
        from public.stock s
        join public.deposito d on d.id_deposito = s.id_deposito and d.activo
        where s.id_producto = p.id_producto
      ), 0) as stock_disponible
    from public.producto p
    join lista on true
    join public.lista_precio_detalle lpd
      on lpd.id_lista_precio = lista.id_lista_precio and lpd.id_producto = p.id_producto
    join public.marca m on m.id_marca = p.id_marca
    join public.unidad_medida um on um.id_unidad_medida = p.id_unidad_medida
    left join public.categoria c on c.id_categoria = p.id_categoria
    left join public.rubro r on r.id_rubro = p.id_rubro
    where p.activo and p.publicado_tienda
      and (p_id_categoria is null or p.id_categoria = p_id_categoria)
      and (p_id_rubro is null or p.id_rubro = p_id_rubro)
      and (p_id_marca is null or p.id_marca = p_id_marca)
      and (
        p_busqueda is null or length(btrim(p_busqueda)) = 0
        or p.nombre_producto ilike '%' || btrim(p_busqueda) || '%'
        or m.nombre_marca ilike '%' || btrim(p_busqueda) || '%'
      )
  )
  select b.id_producto, b.nombre_producto, b.nombre_marca, b.presentacion,
         b.nombre_categoria, b.nombre_rubro, b.precio, b.stock_disponible,
         count(*) over () as total_resultados
  from base b
  order by b.nombre_producto, b.id_producto
  limit 24 offset (greatest(coalesce(p_pagina, 1), 1) - 1) * 24;
$function$;

revoke all on function public.fn_tienda_catalogo_listar(text, uuid, uuid, uuid, integer) from public;
grant execute on function public.fn_tienda_catalogo_listar(text, uuid, uuid, uuid, integer)
  to anon, authenticated, service_role;
