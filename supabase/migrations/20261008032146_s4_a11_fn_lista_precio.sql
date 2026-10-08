-- S4-3 | A-11 | Funciones fn_lista_precio_* (D-024). Errcodes LPR01..LPR06.
-- Todas INVOKER: la seguridad la da el RLS de lista_precio / lista_precio_detalle.
-- Estado de vigencia (a current_date): Vencida si fecha_fin < hoy; Futura si fecha_inicio > hoy; Vigente si no.

-- ---------------------------------------------------------------------
-- Crear (opcionalmente copiando los precios de otra lista con un ajuste %)
-- ---------------------------------------------------------------------
create or replace function public.fn_lista_precio_crear(
  p_nombre_lista_precio text,
  p_tipo_lista          public.tipo_lista_precio,
  p_fecha_inicio        date,
  p_fecha_fin           date default null,
  p_observaciones       text default null,
  p_id_lista_origen     uuid default null,
  p_ajuste_porcentaje   numeric default 0
)
returns public.lista_precio
language plpgsql
set search_path to 'public'
as $$
declare
  v_nombre text := btrim(p_nombre_lista_precio);
  v_ajuste numeric := coalesce(p_ajuste_porcentaje, 0);
  v_lista  public.lista_precio;
begin
  if v_nombre is null or length(v_nombre) = 0 then
    raise exception 'El nombre de la lista de precios no puede estar vacío'
      using errcode = 'LPR01';
  end if;

  if p_tipo_lista is null then
    raise exception 'El tipo de lista es obligatorio' using errcode = 'LPR02';
  end if;
  if p_fecha_inicio is null then
    raise exception 'La fecha de inicio es obligatoria' using errcode = 'LPR02';
  end if;
  if p_fecha_fin is not null and p_fecha_fin < p_fecha_inicio then
    raise exception 'La fecha de fin no puede ser anterior a la de inicio'
      using errcode = 'LPR02';
  end if;
  if p_fecha_fin is not null and p_fecha_fin < current_date then
    raise exception 'No se puede crear una lista que ya está vencida'
      using errcode = 'LPR02';
  end if;

  if p_id_lista_origen is not null
     and not exists (select 1 from public.lista_precio where id_lista_precio = p_id_lista_origen) then
    raise exception 'No se encontró la lista de precios de origen' using errcode = 'LPR04';
  end if;

  if v_ajuste < -100 then
    raise exception 'El ajuste porcentual no puede ser menor a -100' using errcode = 'LPR06';
  end if;

  begin
    insert into public.lista_precio
      (nombre_lista_precio, tipo_lista, fecha_inicio, fecha_fin, observaciones)
    values
      (v_nombre, p_tipo_lista, p_fecha_inicio, p_fecha_fin, nullif(btrim(p_observaciones), ''))
    returning * into v_lista;
  exception
    when unique_violation then
      raise exception 'Ya existe una lista de precios con el nombre "%"', v_nombre
        using errcode = 'LPR01';
    when exclusion_violation then
      raise exception 'Las fechas se superponen con otra lista de tipo %', p_tipo_lista
        using errcode = 'LPR03';
  end;

  if p_id_lista_origen is not null then
    insert into public.lista_precio_detalle (id_lista_precio, id_producto, precio)
    select v_lista.id_lista_precio, d.id_producto, round(d.precio * (1 + v_ajuste / 100), 2)
    from public.lista_precio_detalle d
    where d.id_lista_precio = p_id_lista_origen;
  end if;

  return v_lista;
end;
$$;

-- ---------------------------------------------------------------------
-- Modificar cabecera (el tipo no se cambia; el inicio solo si la lista es futura)
-- ---------------------------------------------------------------------
create or replace function public.fn_lista_precio_modificar(
  p_id_lista_precio     uuid,
  p_nombre_lista_precio text,
  p_fecha_inicio        date,
  p_fecha_fin           date default null,
  p_observaciones       text default null
)
returns public.lista_precio
language plpgsql
set search_path to 'public'
as $$
declare
  v_nombre text := btrim(p_nombre_lista_precio);
  v_actual public.lista_precio;
  v_lista  public.lista_precio;
begin
  select * into v_actual from public.lista_precio where id_lista_precio = p_id_lista_precio;
  if not found then
    raise exception 'No se encontró la lista de precios indicada' using errcode = 'LPR04';
  end if;

  if v_actual.fecha_fin is not null and v_actual.fecha_fin < current_date then
    raise exception 'La lista está vencida y es de solo lectura' using errcode = 'LPR05';
  end if;

  if v_nombre is null or length(v_nombre) = 0 then
    raise exception 'El nombre de la lista de precios no puede estar vacío'
      using errcode = 'LPR01';
  end if;

  if p_fecha_inicio is null then
    raise exception 'La fecha de inicio es obligatoria' using errcode = 'LPR02';
  end if;
  if v_actual.fecha_inicio <= current_date and p_fecha_inicio <> v_actual.fecha_inicio then
    raise exception 'La fecha de inicio solo se puede cambiar en una lista futura'
      using errcode = 'LPR02';
  end if;
  if p_fecha_fin is not null and p_fecha_fin < p_fecha_inicio then
    raise exception 'La fecha de fin no puede ser anterior a la de inicio'
      using errcode = 'LPR02';
  end if;
  if p_fecha_fin is not null and p_fecha_fin < current_date then
    raise exception 'La fecha de fin no puede ser anterior a hoy' using errcode = 'LPR02';
  end if;

  begin
    update public.lista_precio
    set nombre_lista_precio = v_nombre,
        fecha_inicio        = p_fecha_inicio,
        fecha_fin           = p_fecha_fin,
        observaciones       = nullif(btrim(p_observaciones), ''),
        editado             = now()
    where id_lista_precio = p_id_lista_precio
    returning * into v_lista;
  exception
    when unique_violation then
      raise exception 'Ya existe otra lista de precios con el nombre "%"', v_nombre
        using errcode = 'LPR01';
    when exclusion_violation then
      raise exception 'Las fechas se superponen con otra lista de tipo %', v_actual.tipo_lista
        using errcode = 'LPR03';
  end;

  return v_lista;
end;
$$;

-- ---------------------------------------------------------------------
-- Guardar precios (upsert). p_precios = [{"id_producto": uuid, "precio": numeric}, ...]
-- Devuelve la cantidad de precios guardados.
-- ---------------------------------------------------------------------
create or replace function public.fn_lista_precio_precios_guardar(
  p_id_lista_precio uuid,
  p_precios         jsonb
)
returns integer
language plpgsql
set search_path to 'public'
as $$
declare
  v_lista public.lista_precio;
  v_n     integer;
begin
  select * into v_lista from public.lista_precio where id_lista_precio = p_id_lista_precio;
  if not found then
    raise exception 'No se encontró la lista de precios indicada' using errcode = 'LPR04';
  end if;
  if v_lista.fecha_fin is not null and v_lista.fecha_fin < current_date then
    raise exception 'La lista está vencida y es de solo lectura' using errcode = 'LPR05';
  end if;

  if p_precios is null or jsonb_typeof(p_precios) <> 'array' or jsonb_array_length(p_precios) = 0 then
    raise exception 'Hay que indicar al menos un precio' using errcode = 'LPR06';
  end if;

  begin
    perform 1 from jsonb_to_recordset(p_precios) as r(id_producto uuid, precio numeric);
  exception
    when invalid_text_representation or datatype_mismatch or invalid_parameter_value then
      raise exception 'El formato de los precios es inválido' using errcode = 'LPR06';
  end;

  if exists (
    select 1 from jsonb_to_recordset(p_precios) as r(id_producto uuid, precio numeric)
    where r.id_producto is null or r.precio is null or r.precio < 0
  ) then
    raise exception 'Cada precio necesita un artículo y un importe mayor o igual a 0'
      using errcode = 'LPR06';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_precios) as r(id_producto uuid, precio numeric)
    group by r.id_producto having count(*) > 1
  ) then
    raise exception 'Hay artículos repetidos en la lista de precios a guardar'
      using errcode = 'LPR06';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_precios) as r(id_producto uuid, precio numeric)
    where not exists (select 1 from public.producto p where p.id_producto = r.id_producto)
  ) then
    raise exception 'Hay artículos inexistentes en la lista de precios a guardar'
      using errcode = 'LPR06';
  end if;

  begin
    insert into public.lista_precio_detalle (id_lista_precio, id_producto, precio)
    select p_id_lista_precio, r.id_producto, r.precio
    from jsonb_to_recordset(p_precios) as r(id_producto uuid, precio numeric)
    on conflict (id_lista_precio, id_producto)
    do update set precio = excluded.precio;
    get diagnostics v_n = row_count;
  exception
    when numeric_value_out_of_range then
      raise exception 'Un precio excede el máximo permitido' using errcode = 'LPR06';
  end;

  update public.lista_precio set editado = now() where id_lista_precio = p_id_lista_precio;

  return v_n;
end;
$$;

-- ---------------------------------------------------------------------
-- Quitar un artículo de la lista
-- ---------------------------------------------------------------------
create or replace function public.fn_lista_precio_precio_quitar(
  p_id_lista_precio uuid,
  p_id_producto     uuid
)
returns void
language plpgsql
set search_path to 'public'
as $$
declare
  v_lista public.lista_precio;
begin
  select * into v_lista from public.lista_precio where id_lista_precio = p_id_lista_precio;
  if not found then
    raise exception 'No se encontró la lista de precios indicada' using errcode = 'LPR04';
  end if;
  if v_lista.fecha_fin is not null and v_lista.fecha_fin < current_date then
    raise exception 'La lista está vencida y es de solo lectura' using errcode = 'LPR05';
  end if;

  delete from public.lista_precio_detalle
  where id_lista_precio = p_id_lista_precio and id_producto = p_id_producto;
  if not found then
    raise exception 'El artículo no tiene precio en esta lista' using errcode = 'LPR06';
  end if;

  update public.lista_precio set editado = now() where id_lista_precio = p_id_lista_precio;
end;
$$;

-- ---------------------------------------------------------------------
-- Listar (filtros opcionales por tipo y estado: 'Vigente' | 'Futura' | 'Vencida')
-- ---------------------------------------------------------------------
create or replace function public.fn_lista_precio_listar(
  p_tipo_lista public.tipo_lista_precio default null,
  p_estado     text default null
)
returns table (
  id_lista_precio     uuid,
  nombre_lista_precio text,
  tipo_lista          public.tipo_lista_precio,
  fecha_inicio        date,
  fecha_fin           date,
  observaciones       text,
  estado_vigencia     text,
  cantidad_articulos  bigint,
  por_vencer          boolean,
  creado              timestamptz,
  editado             timestamptz,
  creado_por          uuid,
  creado_por_nombre   text
)
language sql
stable
set search_path to 'public'
as $$
  select *
  from (
    select
      l.id_lista_precio,
      l.nombre_lista_precio,
      l.tipo_lista,
      l.fecha_inicio,
      l.fecha_fin,
      l.observaciones,
      case
        when l.fecha_fin is not null and l.fecha_fin < current_date then 'Vencida'
        when l.fecha_inicio > current_date then 'Futura'
        else 'Vigente'
      end as estado_vigencia,
      (select count(*) from public.lista_precio_detalle d
        where d.id_lista_precio = l.id_lista_precio) as cantidad_articulos,
      (
        l.fecha_inicio <= current_date
        and l.fecha_fin is not null
        and l.fecha_fin >= current_date
        and l.fecha_fin - current_date <= 7
        and not exists (
          select 1 from public.lista_precio s
          where s.tipo_lista = l.tipo_lista and s.fecha_inicio > l.fecha_fin
        )
      ) as por_vencer,
      l.creado,
      l.editado,
      l.creado_por,
      coalesce(ur.nombre_completo, 'Usuario no disponible') as creado_por_nombre
    from public.lista_precio l
    left join public.vw_usuario_resumen ur on ur.id_usuario = l.creado_por
  ) x
  where (p_tipo_lista is null or x.tipo_lista = p_tipo_lista)
    and (p_estado is null or x.estado_vigencia = p_estado)
  order by x.tipo_lista, x.fecha_inicio desc;
$$;

-- ---------------------------------------------------------------------
-- Obtener una lista con sus precios (jsonb)
-- ---------------------------------------------------------------------
create or replace function public.fn_lista_precio_obtener(p_id_lista_precio uuid)
returns jsonb
language plpgsql
stable
set search_path to 'public'
as $$
declare
  v_res jsonb;
begin
  select jsonb_build_object(
    'id_lista_precio', l.id_lista_precio,
    'nombre_lista_precio', l.nombre_lista_precio,
    'tipo_lista', l.tipo_lista,
    'fecha_inicio', l.fecha_inicio,
    'fecha_fin', l.fecha_fin,
    'observaciones', l.observaciones,
    'estado_vigencia', case
        when l.fecha_fin is not null and l.fecha_fin < current_date then 'Vencida'
        when l.fecha_inicio > current_date then 'Futura'
        else 'Vigente' end,
    'por_vencer', (
        l.fecha_inicio <= current_date and l.fecha_fin is not null
        and l.fecha_fin >= current_date and l.fecha_fin - current_date <= 7
        and not exists (select 1 from public.lista_precio s
                        where s.tipo_lista = l.tipo_lista and s.fecha_inicio > l.fecha_fin)),
    'creado', l.creado,
    'editado', l.editado,
    'creado_por', l.creado_por,
    'creado_por_nombre', coalesce(ur.nombre_completo, 'Usuario no disponible'),
    'precios', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id_producto', d.id_producto,
               'codigo_producto', p.codigo_producto,
               'nombre_producto', p.nombre_producto,
               'activo', p.activo,
               'precio', d.precio,
               'editado', d.editado)
             order by p.nombre_producto)
      from public.lista_precio_detalle d
      join public.producto p on p.id_producto = d.id_producto
      where d.id_lista_precio = l.id_lista_precio
    ), '[]'::jsonb)
  )
  into v_res
  from public.lista_precio l
  left join public.vw_usuario_resumen ur on ur.id_usuario = l.creado_por
  where l.id_lista_precio = p_id_lista_precio;

  if v_res is null then
    raise exception 'No se encontró la lista de precios indicada' using errcode = 'LPR04';
  end if;

  return v_res;
end;
$$;

-- ---------------------------------------------------------------------
-- Lista vigente de un tipo en una fecha (vacío si no hay). La usa la venta.
-- ---------------------------------------------------------------------
create or replace function public.fn_lista_precio_vigente(
  p_tipo_lista public.tipo_lista_precio,
  p_fecha      date default current_date
)
returns setof public.lista_precio
language sql
stable
set search_path to 'public'
as $$
  select l.*
  from public.lista_precio l
  where l.tipo_lista = p_tipo_lista
    and l.fecha_inicio <= coalesce(p_fecha, current_date)
    and (l.fecha_fin is null or l.fecha_fin >= coalesce(p_fecha, current_date));
$$;

-- Permisos: sin anon ni PUBLIC (criterio de s3_ventas_mayoristas)
revoke execute on function
  public.fn_lista_precio_crear(text, public.tipo_lista_precio, date, date, text, uuid, numeric),
  public.fn_lista_precio_modificar(uuid, text, date, date, text),
  public.fn_lista_precio_precios_guardar(uuid, jsonb),
  public.fn_lista_precio_precio_quitar(uuid, uuid),
  public.fn_lista_precio_listar(public.tipo_lista_precio, text),
  public.fn_lista_precio_obtener(uuid),
  public.fn_lista_precio_vigente(public.tipo_lista_precio, date)
from public, anon;

grant execute on function
  public.fn_lista_precio_crear(text, public.tipo_lista_precio, date, date, text, uuid, numeric),
  public.fn_lista_precio_modificar(uuid, text, date, date, text),
  public.fn_lista_precio_precios_guardar(uuid, jsonb),
  public.fn_lista_precio_precio_quitar(uuid, uuid),
  public.fn_lista_precio_listar(public.tipo_lista_precio, text),
  public.fn_lista_precio_obtener(uuid),
  public.fn_lista_precio_vigente(public.tipo_lista_precio, date)
to authenticated, service_role;
