-- S5-19b: sucursales donde se puede retirar un pedido de la tienda online.
-- Funcion nueva (no modifica ninguna existente). Devuelve los depositos activos que tienen stock
-- suficiente para TODAS las lineas del carrito (un solo deposito debe cubrir el pedido).
-- p_items: [{"id_producto": "<uuid>", "cantidad": <numero > 0>}, ...]. Los repetidos se suman.
-- Si algun articulo no existe, esta inactivo o no esta publicado, ninguna sucursal califica (vacio).
-- Carrito vacio: devuelve vacio.
-- Errcodes: CAR01 (p_items no es un arreglo o supera 100 lineas), CAR02 (linea con id o cantidad invalidos);
-- mismos que fn_tienda_carrito_validar.
-- SECURITY DEFINER con minimas columnas: anon no tiene acceso directo a las tablas.
create or replace function public.fn_tienda_sucursales_retiro(p_items jsonb)
returns table(
  id_deposito uuid,
  nombre_deposito text,
  direccion_deposito text,
  telefono_deposito text,
  horario_apertura time,
  horario_cierre time
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
  select d.id_deposito, d.nombre_deposito, d.direccion_deposito, d.telefono_deposito,
         d.horario_apertura, d.horario_cierre
  from public.deposito d
  where d.activo
    and exists (select 1 from lineas)
    and not exists (
      select 1
      from lineas li
      left join public.producto p
        on p.id_producto = li.id_producto and p.activo and p.publicado_tienda
      where p.id_producto is null
         or coalesce((
              select sum(s.cantidad)
              from public.stock s
              where s.id_producto = li.id_producto and s.id_deposito = d.id_deposito
            ), 0) < li.cantidad
    )
  order by d.nombre_deposito;
end;
$function$;

revoke all on function public.fn_tienda_sucursales_retiro(jsonb) from public;
grant execute on function public.fn_tienda_sucursales_retiro(jsonb)
  to anon, authenticated, service_role;
