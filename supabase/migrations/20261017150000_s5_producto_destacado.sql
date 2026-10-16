-- S5-16 (E-01): productos destacados de la portada de la tienda.
-- Columna producto.destacado_tienda + funcion propia para marcarla (fn_producto_modificar pisa
-- precios con 0, ver Problemas conocidos n 7). Cambia el tipo de retorno / la firma de dos funciones
-- de lectura (DROP + CREATE, mismos filtros y grants que antes, incluida la regla "solo con foto"):
--   fn_tienda_catalogo_listar suma p_solo_destacados (default false)
--   fn_producto_tienda_obtener (ERP) suma destacado_tienda al final.
-- Errcodes: PRD04 (producto inexistente, ya existente), PRD12 (valor invalido).
-- Reversion: drop function fn_producto_destacar_tienda; reaplicar 20261017120000/20261017140000;
--            alter table producto drop column destacado_tienda.
alter table public.producto
  add column if not exists destacado_tienda boolean not null default false;

create or replace function public.fn_producto_destacar_tienda(p_id_producto uuid, p_destacado boolean)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  if p_destacado is null then
    raise exception 'Indicá si el artículo se destaca o no en la tienda' using errcode = 'PRD12';
  end if;

  update public.producto
  set destacado_tienda = p_destacado,
      editado = now()
  where id_producto = p_id_producto;

  if not found then
    raise exception 'No se encontró el producto indicado' using errcode = 'PRD04';
  end if;

  return p_destacado;
end;
$$;

revoke all on function public.fn_producto_destacar_tienda(uuid, boolean) from public, anon;
grant execute on function public.fn_producto_destacar_tienda(uuid, boolean) to authenticated;

drop function if exists public.fn_tienda_catalogo_listar(text, uuid, uuid, uuid, integer, boolean);
create function public.fn_tienda_catalogo_listar(
  p_busqueda text default null,
  p_id_categoria uuid default null,
  p_id_rubro uuid default null,
  p_id_marca uuid default null,
  p_pagina integer default 1,
  p_solo_ofertas boolean default false,
  p_solo_destacados boolean default false
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
  total_resultados bigint,
  precio_lista numeric,
  en_oferta boolean,
  imagen_url text
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
      coalesce(ofe.precio_oferta, lpd.precio) as precio,
      coalesce((
        select sum(s.cantidad)
        from public.stock s
        join public.deposito d on d.id_deposito = s.id_deposito and d.activo
        where s.id_producto = p.id_producto
      ), 0) as stock_disponible,
      lpd.precio as precio_lista,
      (ofe.precio_oferta is not null) as en_oferta,
      p.imagen_url
    from public.producto p
    join lista on true
    join public.lista_precio_detalle lpd
      on lpd.id_lista_precio = lista.id_lista_precio and lpd.id_producto = p.id_producto
    join public.marca m on m.id_marca = p.id_marca
    join public.unidad_medida um on um.id_unidad_medida = p.id_unidad_medida
    left join public.categoria c on c.id_categoria = p.id_categoria
    left join public.rubro r on r.id_rubro = p.id_rubro
    left join lateral (
      select o.precio_oferta
      from public.producto_oferta o
      where o.id_producto = p.id_producto
        and current_date between o.fecha_inicio and coalesce(o.fecha_fin, 'infinity'::date)
        and o.precio_oferta < lpd.precio
      limit 1
    ) ofe on true
    where p.activo and p.publicado_tienda and p.imagen_url is not null
      and (p_id_categoria is null or p.id_categoria = p_id_categoria)
      and (p_id_rubro is null or p.id_rubro = p_id_rubro)
      and (p_id_marca is null or p.id_marca = p_id_marca)
      and (not coalesce(p_solo_ofertas, false) or ofe.precio_oferta is not null)
      and (not coalesce(p_solo_destacados, false) or p.destacado_tienda)
      and (
        p_busqueda is null or length(btrim(p_busqueda)) = 0
        or p.nombre_producto ilike '%' || btrim(p_busqueda) || '%'
        or m.nombre_marca ilike '%' || btrim(p_busqueda) || '%'
      )
  )
  select b.id_producto, b.nombre_producto, b.nombre_marca, b.presentacion,
         b.nombre_categoria, b.nombre_rubro, b.precio, b.stock_disponible,
         count(*) over () as total_resultados,
         b.precio_lista, b.en_oferta, b.imagen_url
  from base b
  order by b.nombre_producto, b.id_producto
  limit 24 offset (greatest(coalesce(p_pagina, 1), 1) - 1) * 24;
$function$;

revoke all on function public.fn_tienda_catalogo_listar(text, uuid, uuid, uuid, integer, boolean, boolean) from public;
grant execute on function public.fn_tienda_catalogo_listar(text, uuid, uuid, uuid, integer, boolean, boolean)
  to anon, authenticated, service_role;

drop function if exists public.fn_producto_tienda_obtener(uuid);
create function public.fn_producto_tienda_obtener(p_id_producto uuid)
returns table(imagen_url text, precio_lista numeric, ofertas jsonb, destacado_tienda boolean)
language sql
stable
set search_path = public
as $$
  select
    p.imagen_url,
    (select lpd.precio
       from public.lista_precio l
       join public.lista_precio_detalle lpd
         on lpd.id_lista_precio = l.id_lista_precio and lpd.id_producto = p.id_producto
      where l.tipo_lista = 'Minorista'
        and current_date between l.fecha_inicio and coalesce(l.fecha_fin, 'infinity'::date)
      limit 1),
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'id_oferta', o.id_oferta, 'precio_oferta', o.precio_oferta,
               'fecha_inicio', o.fecha_inicio, 'fecha_fin', o.fecha_fin)
             order by o.fecha_inicio)
      from public.producto_oferta o
      where o.id_producto = p.id_producto
        and (o.fecha_fin is null or o.fecha_fin >= current_date)
    ), '[]'::jsonb),
    p.destacado_tienda
  from public.producto p
  where p.id_producto = p_id_producto;
$$;

revoke all on function public.fn_producto_tienda_obtener(uuid) from public, anon;
grant execute on function public.fn_producto_tienda_obtener(uuid) to authenticated;
