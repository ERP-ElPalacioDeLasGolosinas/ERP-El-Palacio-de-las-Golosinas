-- Versionada en el repo el 2026-10-07 (S4-1) a partir de supabase_migrations.schema_migrations.
-- Ya aplicada en la nube con esta misma version; no reaplicar.

-- Códigos nuevos: TCL05 (no inhabilitar) y TCL06 (no cambiar lista de precios)

create or replace function public.fn_tipo_cliente_modificar(
  p_id_tipo_cliente     uuid,
  p_nombre_tipo_cliente text,
  p_lista_precio        public.tipo_lista_precio
)
returns public.tipo_cliente
language plpgsql
set search_path to 'public'
as $$
declare
  v_nombre text := btrim(p_nombre_tipo_cliente);
  v_actual public.tipo_cliente;
  v_tipo   public.tipo_cliente;
begin
  if v_nombre is null or length(v_nombre) = 0 then
    raise exception 'El nombre del tipo de cliente no puede estar vacío'
      using errcode = 'TCL01';
  end if;

  if p_lista_precio is null then
    raise exception 'La lista de precios es obligatoria'
      using errcode = 'TCL02';
  end if;

  select * into v_actual from public.tipo_cliente where id_tipo_cliente = p_id_tipo_cliente;

  if not found then
    raise exception 'No se encontró el tipo de cliente indicado'
      using errcode = 'TCL04';
  end if;

  -- Protección: el tipo del cliente Consumidor Final no puede cambiar de lista de precios
  if p_lista_precio is distinct from v_actual.lista_precio
     and exists (
       select 1 from public.cliente
       where id_tipo_cliente = p_id_tipo_cliente and es_consumidor_final = true
     ) then
    raise exception 'No se puede cambiar la lista de precios del tipo "%" porque está asignado al cliente Consumidor Final', v_actual.nombre_tipo_cliente
      using errcode = 'TCL06';
  end if;

  if exists (
    select 1 from public.tipo_cliente
    where lower(btrim(nombre_tipo_cliente)) = lower(v_nombre)
      and id_tipo_cliente <> p_id_tipo_cliente
  ) then
    raise exception 'Ya existe otro tipo de cliente con el nombre "%"', v_nombre
      using errcode = 'TCL03';
  end if;

  begin
    update public.tipo_cliente
    set nombre_tipo_cliente = v_nombre,
        lista_precio        = p_lista_precio,
        editado             = now()
    where id_tipo_cliente = p_id_tipo_cliente
    returning * into v_tipo;
  exception
    when unique_violation then
      raise exception 'Ya existe otro tipo de cliente con el nombre "%"', v_nombre
        using errcode = 'TCL03';
  end;

  return v_tipo;
end;
$$;

create or replace function public.fn_tipo_cliente_inhabilitar(p_id_tipo_cliente uuid)
returns public.tipo_cliente
language plpgsql
set search_path to 'public'
as $$
declare
  v_actual public.tipo_cliente;
  v_tipo   public.tipo_cliente;
begin
  select * into v_actual from public.tipo_cliente where id_tipo_cliente = p_id_tipo_cliente;

  if not found then
    raise exception 'No se encontró el tipo de cliente indicado'
      using errcode = 'TCL04';
  end if;

  -- Protección: no se puede inhabilitar el tipo del cliente Consumidor Final
  if exists (
    select 1 from public.cliente
    where id_tipo_cliente = p_id_tipo_cliente and es_consumidor_final = true
  ) then
    raise exception 'No se puede inhabilitar el tipo "%" porque está asignado al cliente Consumidor Final', v_actual.nombre_tipo_cliente
      using errcode = 'TCL05';
  end if;

  update public.tipo_cliente
  set activo = false,
      editado = now()
  where id_tipo_cliente = p_id_tipo_cliente
  returning * into v_tipo;

  return v_tipo;
end;
$$;
