-- S5-15e (E-01): la tienda solo muestra articulos con foto.
-- Agrega `and p.imagen_url is not null` al filtro "activo y publicado" de fn_tienda_catalogo_listar,
-- fn_tienda_producto_obtener (el detalle por URL directa da 404 sin foto) y fn_tienda_filtros_listar
-- (no ofrece categorias/rubros/marcas que quedarian vacios). Misma firma, mismos grants: se reescribe
-- la definicion vigente de cada funcion (idempotente: no repite el cambio si ya esta aplicado).
-- No toca fn_tienda_carrito_validar: un carrito ya armado o un pedido en curso no se rompe.
-- Reversion: quitar esa condicion de las tres funciones.
do $$
declare
  v_firma text;
  v_def text;
begin
  foreach v_firma in array array[
    'public.fn_tienda_catalogo_listar(text, uuid, uuid, uuid, integer, boolean)',
    'public.fn_tienda_producto_obtener(uuid)',
    'public.fn_tienda_filtros_listar()'
  ] loop
    v_def := pg_get_functiondef(v_firma::regprocedure);
    if position('p.imagen_url is not null' in v_def) = 0 then
      v_def := replace(v_def, 'p.activo and p.publicado_tienda',
                              'p.activo and p.publicado_tienda and p.imagen_url is not null');
      execute v_def;
    end if;
  end loop;
end;
$$;
