-- S5-2b (AO-01): fn_producto_listar devuelve publicado_tienda (ultima columna).
-- Cambia el tipo de retorno, por eso DROP + CREATE (misma firma, mismo cuerpo, mismos grants).
drop function if exists public.fn_producto_listar(boolean, uuid, uuid, uuid, text, uuid);

create function public.fn_producto_listar(
  p_incluir_inactivos boolean default true,
  p_id_marca uuid default null,
  p_id_categoria uuid default null,
  p_id_rubro uuid default null,
  p_busqueda text default null,
  p_id_producto uuid default null
)
returns table(
  id_producto uuid, codigo_producto character varying, nombre_producto text, descripcion_producto text,
  nombre_completo text, id_marca uuid, nombre_marca text, id_unidad_medida uuid, nombre_unidad_medida text,
  abreviatura_unidad_medida text, numero_medida numeric, id_categoria uuid, nombre_categoria text,
  id_rubro uuid, nombre_rubro text, precio_producto numeric, costo_producto numeric,
  precio_mayorista_producto numeric, precio_minorista_producto numeric, activo boolean,
  creado timestamp with time zone, editado timestamp with time zone, creado_por uuid,
  creado_por_nombre text, publicado_tienda boolean
)
language sql
stable
set search_path to 'public'
as $function$
  select
    p.id_producto, p.codigo_producto, p.nombre_producto, p.descripcion_producto,
    p.nombre_producto || ' - ' || m.nombre_marca || ' (' || p.numero_medida || ' ' || um.abreviatura || ')' as nombre_completo,
    p.id_marca, m.nombre_marca, p.id_unidad_medida, um.nombre as nombre_unidad_medida,
    um.abreviatura as abreviatura_unidad_medida, p.numero_medida, p.id_categoria,
    c.nombre_categoria, p.id_rubro, r.nombre_rubro, p.precio_producto, p.costo_producto,
    p.precio_mayorista_producto, p.precio_minorista_producto, p.activo, p.creado,
    p.editado, p.creado_por,
    coalesce(u.nombre_completo, 'Usuario no disponible') as creado_por_nombre,
    p.publicado_tienda
  from public.producto p
  join public.marca m on m.id_marca = p.id_marca
  join public.unidad_medida um on um.id_unidad_medida = p.id_unidad_medida
  left join public.categoria c on c.id_categoria = p.id_categoria
  left join public.rubro r on r.id_rubro = p.id_rubro
  left join public.vw_usuario_resumen u on u.id_usuario = p.creado_por
  where (p_incluir_inactivos or p.activo = true)
    and (p_id_marca is null or p.id_marca = p_id_marca)
    and (p_id_categoria is null or p.id_categoria = p_id_categoria)
    and (p_id_rubro is null or p.id_rubro = p_id_rubro)
    and (p_id_producto is null or p.id_producto = p_id_producto)
    and (
      p_busqueda is null or length(btrim(p_busqueda)) = 0
      or p.nombre_producto ilike '%' || btrim(p_busqueda) || '%'
      or p.codigo_producto ilike '%' || btrim(p_busqueda) || '%'
    )
  order by p.nombre_producto;
$function$;

grant execute on function public.fn_producto_listar(boolean, uuid, uuid, uuid, text, uuid)
  to anon, authenticated, service_role;
