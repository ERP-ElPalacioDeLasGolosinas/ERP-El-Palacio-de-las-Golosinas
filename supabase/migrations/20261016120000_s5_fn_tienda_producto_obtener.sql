-- S5-3c (E-01): detalle publico de un articulo de la tienda online.
-- Mismas reglas que fn_tienda_catalogo_listar: activo, publicado y con precio en la lista
-- Minorista vigente. Si no cumple devuelve 0 filas. Suma descripcion_producto.
-- SECURITY DEFINER con minimas columnas: anon no tiene acceso directo a las tablas.
create or replace function public.fn_tienda_producto_obtener(p_id_producto uuid)
returns table(
  id_producto uuid,
  nombre_producto text,
  descripcion_producto text,
  nombre_marca text,
  presentacion text,
  nombre_categoria text,
  nombre_rubro text,
  precio numeric,
  stock_disponible numeric
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
    lpd.precio,
    coalesce((
      select sum(s.cantidad)
      from public.stock s
      join public.deposito d on d.id_deposito = s.id_deposito and d.activo
      where s.id_producto = p.id_producto
    ), 0)
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
  where p.id_producto = p_id_producto
    and p.activo and p.publicado_tienda
  limit 1;
$function$;

revoke all on function public.fn_tienda_producto_obtener(uuid) from public;
grant execute on function public.fn_tienda_producto_obtener(uuid)
  to anon, authenticated, service_role;
