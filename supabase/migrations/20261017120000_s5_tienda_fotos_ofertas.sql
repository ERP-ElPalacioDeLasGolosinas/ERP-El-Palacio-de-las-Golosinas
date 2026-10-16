-- S5-15c (E-01, E-02): la tienda muestra foto y oferta vigente.
-- Cambia el tipo de retorno de tres funciones de lectura de la tienda (DROP + CREATE; mismos filtros
-- y mismos grants que antes). Cada una suma, al final:
--   precio_lista numeric  precio Minorista sin oferta
--   en_oferta boolean     hay una oferta vigente hoy (precio_oferta < precio de lista)
--   imagen_url text       foto del articulo
-- `precio` pasa a ser el precio efectivo (oferta si hay, lista si no). Como fn_pedido_web_registrar
-- toma el precio de fn_tienda_carrito_validar, el pedido se cobra al mismo precio que se muestra.
-- fn_tienda_catalogo_listar suma p_solo_ofertas (default false) y cambia de firma.
-- Reversion: reaplicar 20261016100000, 20261016120000 y 20261016130000.
drop function if exists public.fn_tienda_catalogo_listar(text, uuid, uuid, uuid, integer);
drop function if exists public.fn_tienda_producto_obtener(uuid);
drop function if exists public.fn_tienda_carrito_validar(jsonb);

create function public.fn_tienda_catalogo_listar(
  p_busqueda text default null,
  p_id_categoria uuid default null,
  p_id_rubro uuid default null,
  p_id_marca uuid default null,
  p_pagina integer default 1,
  p_solo_ofertas boolean default false
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
    where p.activo and p.publicado_tienda
      and (p_id_categoria is null or p.id_categoria = p_id_categoria)
      and (p_id_rubro is null or p.id_rubro = p_id_rubro)
      and (p_id_marca is null or p.id_marca = p_id_marca)
      and (not coalesce(p_solo_ofertas, false) or ofe.precio_oferta is not null)
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

create function public.fn_tienda_producto_obtener(p_id_producto uuid)
returns table(
  id_producto uuid,
  nombre_producto text,
  descripcion_producto text,
  nombre_marca text,
  presentacion text,
  nombre_categoria text,
  nombre_rubro text,
  precio numeric,
  stock_disponible numeric,
  precio_lista numeric,
  en_oferta boolean,
  imagen_url text
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    p.id_producto,
    p.nombre_producto,
    p.descripcion_producto,
    m.nombre_marca,
    p.numero_medida || ' ' || um.abreviatura,
    c.nombre_categoria,
    r.nombre_rubro,
    coalesce(ofe.precio_oferta, lpd.precio),
    coalesce((
      select sum(s.cantidad)
      from public.stock s
      join public.deposito d on d.id_deposito = s.id_deposito and d.activo
      where s.id_producto = p.id_producto
    ), 0),
    lpd.precio,
    (ofe.precio_oferta is not null),
    p.imagen_url
  from public.producto p
  join public.lista_precio l
    on l.tipo_lista = 'Minorista'
   and current_date between l.fecha_inicio and coalesce(l.fecha_fin, 'infinity'::date)
  join public.lista_precio_detalle lpd
    on lpd.id_lista_precio = l.id_lista_precio and lpd.id_producto = p.id_producto
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
  where p.id_producto = p_id_producto
    and p.activo and p.publicado_tienda
  limit 1;
$function$;

create function public.fn_tienda_carrito_validar(p_items jsonb)
returns table(
  id_producto uuid,
  nombre_producto text,
  nombre_marca text,
  presentacion text,
  cantidad_solicitada numeric,
  precio numeric,
  stock_disponible numeric,
  estado text,
  precio_lista numeric,
  en_oferta boolean,
  imagen_url text
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) > 100 then
    raise exception 'El carrito debe ser una lista de hasta 100 lineas' using errcode = 'CAR01';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) e
    where jsonb_typeof(e) <> 'object'
       or (e->>'id_producto') is null
       or (e->>'id_producto') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or jsonb_typeof(e->'cantidad') <> 'number'
       or (e->>'cantidad')::numeric <= 0
  ) then
    raise exception 'Linea de carrito invalida' using errcode = 'CAR02';
  end if;

  return query
  with lineas as (
    select (e->>'id_producto')::uuid as id_producto,
           sum((e->>'cantidad')::numeric) as cantidad
    from jsonb_array_elements(p_items) e
    group by 1
  )
  select
    li.id_producto,
    p.nombre_producto,
    m.nombre_marca,
    p.numero_medida || ' ' || um.abreviatura,
    li.cantidad,
    coalesce(ofe.precio_oferta, lpd.precio),
    coalesce(st.cantidad, 0),
    case
      when p.id_producto is null or lpd.precio is null then 'no_disponible'
      when coalesce(st.cantidad, 0) <= 0 then 'agotado'
      when coalesce(st.cantidad, 0) < li.cantidad then 'stock_insuficiente'
      else 'ok'
    end,
    lpd.precio,
    (ofe.precio_oferta is not null),
    p.imagen_url
  from lineas li
  left join public.producto p
    on p.id_producto = li.id_producto and p.activo and p.publicado_tienda
  left join public.lista_precio l
    on l.tipo_lista = 'Minorista'
   and current_date between l.fecha_inicio and coalesce(l.fecha_fin, 'infinity'::date)
  left join public.lista_precio_detalle lpd
    on lpd.id_lista_precio = l.id_lista_precio and lpd.id_producto = p.id_producto
  left join public.marca m on m.id_marca = p.id_marca
  left join public.unidad_medida um on um.id_unidad_medida = p.id_unidad_medida
  left join lateral (
    select o.precio_oferta
    from public.producto_oferta o
    where o.id_producto = p.id_producto
      and current_date between o.fecha_inicio and coalesce(o.fecha_fin, 'infinity'::date)
      and o.precio_oferta < lpd.precio
    limit 1
  ) ofe on true
  left join lateral (
    select sum(s.cantidad) as cantidad
    from public.stock s
    join public.deposito d on d.id_deposito = s.id_deposito and d.activo
    where s.id_producto = p.id_producto
  ) st on true;
end;
$function$;

revoke all on function public.fn_tienda_catalogo_listar(text, uuid, uuid, uuid, integer, boolean) from public;
revoke all on function public.fn_tienda_producto_obtener(uuid) from public;
revoke all on function public.fn_tienda_carrito_validar(jsonb) from public;
grant execute on function public.fn_tienda_catalogo_listar(text, uuid, uuid, uuid, integer, boolean)
  to anon, authenticated, service_role;
grant execute on function public.fn_tienda_producto_obtener(uuid) to anon, authenticated, service_role;
grant execute on function public.fn_tienda_carrito_validar(jsonb) to anon, authenticated, service_role;
