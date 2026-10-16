-- S5-4a (E-02): validacion del carrito de la tienda online.
-- El carrito vive en localStorage del navegador; esta funcion devuelve, por articulo, el precio
-- (lista Minorista vigente) y el stock vigentes y marca las lineas que ya no alcanzan.
-- p_items: [{"id_producto": "<uuid>", "cantidad": <numero > 0>}, ...]. Los repetidos se suman.
-- estado: ok | stock_insuficiente | agotado | no_disponible (inexistente, inactivo, no publicado o
-- sin precio vigente; precio y stock salen en null/0). Mismas reglas que fn_tienda_catalogo_listar.
-- Errcodes: CAR01 (p_items no es un arreglo o supera 100 lineas), CAR02 (linea con id o cantidad invalidos).
-- SECURITY DEFINER con minimas columnas: anon no tiene acceso directo a las tablas.
create or replace function public.fn_tienda_carrito_validar(p_items jsonb)
returns table(
  id_producto uuid,
  nombre_producto text,
  nombre_marca text,
  presentacion text,
  cantidad_solicitada numeric,
  precio numeric,
  stock_disponible numeric,
  estado text
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
    lpd.precio,
    coalesce(st.cantidad, 0),
    case
      when p.id_producto is null or lpd.precio is null then 'no_disponible'
      when coalesce(st.cantidad, 0) <= 0 then 'agotado'
      when coalesce(st.cantidad, 0) < li.cantidad then 'stock_insuficiente'
      else 'ok'
    end
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
    select sum(s.cantidad) as cantidad
    from public.stock s
    join public.deposito d on d.id_deposito = s.id_deposito and d.activo
    where s.id_producto = p.id_producto
  ) st on true;
end;
$function$;

revoke all on function public.fn_tienda_carrito_validar(jsonb) from public;
grant execute on function public.fn_tienda_carrito_validar(jsonb)
  to anon, authenticated, service_role;
