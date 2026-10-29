-- S5 · Limpieza: se eliminan producto.precio_producto, precio_mayorista_producto y
-- precio_minorista_producto. Los precios viven en lista_precio / lista_precio_detalle desde S4-A11
-- (que ya migró esos valores a las listas); ninguna función ni pantalla los usaba.
-- fn_producto_crear y fn_producto_modificar pierden los tres parámetros (cambia la firma: DROP + CREATE,
-- mismo cuerpo y mismos grants). Resuelve "Problemas conocidos nº 7": modificar ya no pisa precios con 0.
-- fn_producto_listar deja de devolver las tres columnas (cambia el tipo de retorno: DROP + CREATE).
-- Reversión: re-agregar las columnas (numeric default 0 >= 0) y reaplicar las definiciones previas;
-- los valores eliminados no se recuperan (siguen en las listas de precios).

drop function if exists public.fn_producto_crear(uuid, text, text, text, uuid, numeric, uuid, uuid, numeric, numeric, numeric, numeric);
drop function if exists public.fn_producto_modificar(uuid, uuid, text, text, text, uuid, numeric, uuid, numeric, numeric, numeric, numeric);
drop function if exists public.fn_producto_listar(boolean, uuid, uuid, uuid, text, uuid);

alter table public.producto
  drop column precio_producto,
  drop column precio_mayorista_producto,
  drop column precio_minorista_producto;

create function public.fn_producto_crear(
  p_id_marca uuid,
  p_nombre_producto text,
  p_descripcion_producto text,
  p_codigo_producto text,
  p_id_unidad_medida uuid,
  p_numero_medida numeric,
  p_creado_por uuid,
  p_id_categoria uuid default null,
  p_costo_producto numeric default 0
)
returns public.producto
language plpgsql
set search_path to 'public'
as $function$
DECLARE
  v_nombre      text := btrim(p_nombre_producto);
  v_descripcion text := btrim(p_descripcion_producto);
  v_codigo      text := upper(btrim(p_codigo_producto));
  v_producto    public.producto;
BEGIN
  IF v_nombre IS NULL OR length(v_nombre) = 0 THEN
    RAISE EXCEPTION 'El nombre del producto no puede estar vacío'
      USING ERRCODE = 'PRD01';
  END IF;

  IF v_codigo IS NULL OR length(v_codigo) = 0 THEN
    RAISE EXCEPTION 'El código del producto no puede estar vacío'
      USING ERRCODE = 'PRD02';
  END IF;

  IF p_numero_medida IS NULL OR p_numero_medida <= 0 THEN
    RAISE EXCEPTION 'El número de medida debe ser mayor a cero'
      USING ERRCODE = 'PRD08';
  END IF;

  PERFORM public._fn_producto_validar_referencias(p_id_marca, p_id_categoria, p_id_unidad_medida);

  IF EXISTS (SELECT 1 FROM public.producto WHERE upper(btrim(codigo_producto)) = v_codigo) THEN
    RAISE EXCEPTION 'Ya existe un producto con el código "%"', v_codigo
      USING ERRCODE = 'PRD03';
  END IF;

  BEGIN
    INSERT INTO public.producto (
      id_marca, nombre_producto, descripcion_producto, codigo_producto,
      id_categoria, id_unidad_medida, numero_medida,
      costo_producto,
      creado_por
    ) VALUES (
      p_id_marca, v_nombre, v_descripcion, v_codigo,
      p_id_categoria, p_id_unidad_medida, p_numero_medida,
      COALESCE(p_costo_producto, 0),
      p_creado_por
    )
    RETURNING * INTO v_producto;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'Ya existe un producto con el código "%"', v_codigo
        USING ERRCODE = 'PRD03';
  END;

  RETURN v_producto;
END;
$function$;

create function public.fn_producto_modificar(
  p_id_producto uuid,
  p_id_marca uuid,
  p_nombre_producto text,
  p_descripcion_producto text,
  p_codigo_producto text,
  p_id_unidad_medida uuid,
  p_numero_medida numeric,
  p_id_categoria uuid default null,
  p_costo_producto numeric default 0
)
returns public.producto
language plpgsql
set search_path to 'public'
as $function$
DECLARE
  v_nombre      text := btrim(p_nombre_producto);
  v_descripcion text := btrim(p_descripcion_producto);
  v_codigo      text := upper(btrim(p_codigo_producto));
  v_producto    public.producto;
BEGIN
  IF v_nombre IS NULL OR length(v_nombre) = 0 THEN
    RAISE EXCEPTION 'El nombre del producto no puede estar vacío'
      USING ERRCODE = 'PRD01';
  END IF;

  IF v_codigo IS NULL OR length(v_codigo) = 0 THEN
    RAISE EXCEPTION 'El código del producto no puede estar vacío'
      USING ERRCODE = 'PRD02';
  END IF;

  IF p_numero_medida IS NULL OR p_numero_medida <= 0 THEN
    RAISE EXCEPTION 'El número de medida debe ser mayor a cero'
      USING ERRCODE = 'PRD08';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.producto WHERE id_producto = p_id_producto) THEN
    RAISE EXCEPTION 'No se encontró el producto indicado'
      USING ERRCODE = 'PRD04';
  END IF;

  PERFORM public._fn_producto_validar_referencias(p_id_marca, p_id_categoria, p_id_unidad_medida);

  IF EXISTS (
    SELECT 1 FROM public.producto
    WHERE upper(btrim(codigo_producto)) = v_codigo
      AND id_producto <> p_id_producto
  ) THEN
    RAISE EXCEPTION 'Ya existe otro producto con el código "%"', v_codigo
      USING ERRCODE = 'PRD03';
  END IF;

  BEGIN
    UPDATE public.producto
    SET id_marca = p_id_marca,
        nombre_producto = v_nombre,
        descripcion_producto = v_descripcion,
        codigo_producto = v_codigo,
        id_categoria = p_id_categoria,
        id_unidad_medida = p_id_unidad_medida,
        numero_medida = p_numero_medida,
        costo_producto = COALESCE(p_costo_producto, 0),
        editado = now()
    WHERE id_producto = p_id_producto
    RETURNING * INTO v_producto;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'Ya existe otro producto con el código "%"', v_codigo
        USING ERRCODE = 'PRD03';
  END;

  RETURN v_producto;
END;
$function$;

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
  id_rubro uuid, nombre_rubro text, costo_producto numeric, activo boolean,
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
    c.nombre_categoria, p.id_rubro, r.nombre_rubro, p.costo_producto, p.activo, p.creado,
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

revoke all on function public.fn_producto_crear(uuid, text, text, text, uuid, numeric, uuid, uuid, numeric) from public;
revoke all on function public.fn_producto_modificar(uuid, uuid, text, text, text, uuid, numeric, uuid, numeric) from public;
grant execute on function public.fn_producto_crear(uuid, text, text, text, uuid, numeric, uuid, uuid, numeric)
  to anon, authenticated, service_role;
grant execute on function public.fn_producto_modificar(uuid, uuid, text, text, text, uuid, numeric, uuid, numeric)
  to anon, authenticated, service_role;
grant execute on function public.fn_producto_listar(boolean, uuid, uuid, uuid, text, uuid)
  to anon, authenticated, service_role;
