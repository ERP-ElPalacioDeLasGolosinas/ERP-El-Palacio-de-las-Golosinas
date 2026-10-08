-- Versionada en el repo el 2026-10-07 (S4-1) a partir de supabase_migrations.schema_migrations.
-- Ya aplicada en la nube con esta misma version; no reaplicar.
-- fn_tipo_cliente_modificar / _inhabilitar se reemplazan en 20260921175223.

-- =====================================================================
-- V-05 | Tipos de cliente  (códigos de error TCL01..TCL04)
-- =====================================================================

create or replace function public.fn_tipo_cliente_crear(
  p_nombre_tipo_cliente text,
  p_lista_precio        public.tipo_lista_precio,
  p_creado_por          uuid
)
returns public.tipo_cliente
language plpgsql
set search_path to 'public'
as $$
declare
  v_nombre text := btrim(p_nombre_tipo_cliente);
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

  if exists (
    select 1 from public.tipo_cliente
    where lower(btrim(nombre_tipo_cliente)) = lower(v_nombre)
  ) then
    raise exception 'Ya existe un tipo de cliente con el nombre "%"', v_nombre
      using errcode = 'TCL03';
  end if;

  begin
    insert into public.tipo_cliente (nombre_tipo_cliente, lista_precio, creado_por)
    values (v_nombre, p_lista_precio, coalesce(p_creado_por, auth.uid()))
    returning * into v_tipo;
  exception
    when unique_violation then
      raise exception 'Ya existe un tipo de cliente con el nombre "%"', v_nombre
        using errcode = 'TCL03';
  end;

  return v_tipo;
end;
$$;

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

  if not exists (select 1 from public.tipo_cliente where id_tipo_cliente = p_id_tipo_cliente) then
    raise exception 'No se encontró el tipo de cliente indicado'
      using errcode = 'TCL04';
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

create or replace function public.fn_tipo_cliente_habilitar(p_id_tipo_cliente uuid)
returns public.tipo_cliente
language plpgsql
set search_path to 'public'
as $$
declare
  v_tipo public.tipo_cliente;
begin
  if not exists (select 1 from public.tipo_cliente where id_tipo_cliente = p_id_tipo_cliente) then
    raise exception 'No se encontró el tipo de cliente indicado'
      using errcode = 'TCL04';
  end if;

  update public.tipo_cliente
  set activo = true,
      editado = now()
  where id_tipo_cliente = p_id_tipo_cliente
  returning * into v_tipo;

  return v_tipo;
end;
$$;

create or replace function public.fn_tipo_cliente_inhabilitar(p_id_tipo_cliente uuid)
returns public.tipo_cliente
language plpgsql
set search_path to 'public'
as $$
declare
  v_tipo public.tipo_cliente;
begin
  if not exists (select 1 from public.tipo_cliente where id_tipo_cliente = p_id_tipo_cliente) then
    raise exception 'No se encontró el tipo de cliente indicado'
      using errcode = 'TCL04';
  end if;

  update public.tipo_cliente
  set activo = false,
      editado = now()
  where id_tipo_cliente = p_id_tipo_cliente
  returning * into v_tipo;

  return v_tipo;
end;
$$;

create or replace function public.fn_tipo_cliente_listar(p_incluir_inactivos boolean default true)
returns table(
  id_tipo_cliente     uuid,
  nombre_tipo_cliente text,
  lista_precio        public.tipo_lista_precio,
  activo              boolean,
  creado              timestamptz,
  editado             timestamptz,
  creado_por          uuid,
  creado_por_nombre   text,
  cantidad_clientes   bigint
)
language sql
stable
set search_path to 'public'
as $$
  select
    t.id_tipo_cliente,
    t.nombre_tipo_cliente,
    t.lista_precio,
    t.activo,
    t.creado,
    t.editado,
    t.creado_por,
    coalesce(ur.nombre_completo, 'Usuario no disponible') as creado_por_nombre,
    (select count(*) from public.cliente c
      where c.id_tipo_cliente = t.id_tipo_cliente and c.activo = true) as cantidad_clientes
  from public.tipo_cliente t
  left join public.vw_usuario_resumen ur on ur.id_usuario = t.creado_por
  where p_incluir_inactivos or t.activo = true
  order by t.nombre_tipo_cliente;
$$;

-- =====================================================================
-- V-06 | Cartera de clientes  (códigos de error CLI01..CLI08)
-- =====================================================================

create or replace function public.fn_cliente_crear(
  p_nombre_cliente    text,
  p_id_tipo_cliente   uuid,
  p_documento_cliente text,
  p_telefono_cliente  text,
  p_creado_por        uuid,
  p_mail_cliente      text default null,
  p_direccion_cliente text default null
)
returns public.cliente
language plpgsql
set search_path to 'public'
as $$
declare
  v_nombre    text := btrim(p_nombre_cliente);
  v_documento text := btrim(p_documento_cliente);
  v_telefono  text := btrim(p_telefono_cliente);
  v_mail      text := nullif(btrim(p_mail_cliente), '');
  v_direccion text := nullif(btrim(p_direccion_cliente), '');
  v_cliente   public.cliente;
  v_constraint text;
begin
  if v_nombre is null or length(v_nombre) = 0 then
    raise exception 'El nombre del cliente no puede estar vacío'
      using errcode = 'CLI01';
  end if;

  if p_id_tipo_cliente is null then
    raise exception 'Debe seleccionar el tipo de cliente'
      using errcode = 'CLI02';
  end if;

  if not exists (
    select 1 from public.tipo_cliente
    where id_tipo_cliente = p_id_tipo_cliente and activo = true
  ) then
    raise exception 'El tipo de cliente indicado no existe o está inhabilitado'
      using errcode = 'CLI02';
  end if;

  if v_documento is null or length(v_documento) = 0 then
    raise exception 'El documento (DNI o CUIT) no puede estar vacío'
      using errcode = 'CLI03';
  end if;

  if v_documento !~ '^[0-9]{7,8}$' and v_documento !~ '^[0-9]{2}-[0-9]{8}-[0-9]{1}$' then
    raise exception 'El documento debe ser un DNI (7 u 8 dígitos) o un CUIT con formato XX-XXXXXXXX-X'
      using errcode = 'CLI03';
  end if;

  if v_telefono is null or length(v_telefono) = 0 then
    raise exception 'El teléfono es obligatorio'
      using errcode = 'CLI04';
  end if;

  if v_telefono !~ '^[0-9]{6,15}$' then
    raise exception 'El teléfono debe tener entre 6 y 15 dígitos, sin espacios ni guiones'
      using errcode = 'CLI04';
  end if;

  if v_mail is not null and v_mail !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then
    raise exception 'El mail debe tener un formato válido'
      using errcode = 'CLI05';
  end if;

  if exists (select 1 from public.cliente where documento_cliente = v_documento) then
    raise exception 'Ya existe un cliente con el documento "%"', v_documento
      using errcode = 'CLI06';
  end if;

  begin
    insert into public.cliente (
      nombre_cliente, id_tipo_cliente, documento_cliente,
      telefono_cliente, mail_cliente, direccion_cliente, creado_por
    ) values (
      v_nombre, p_id_tipo_cliente, v_documento,
      v_telefono, v_mail, v_direccion, coalesce(p_creado_por, auth.uid())
    )
    returning * into v_cliente;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      raise exception 'Ya existe un cliente con el documento "%"', v_documento
        using errcode = 'CLI06';
  end;

  return v_cliente;
end;
$$;

create or replace function public.fn_cliente_modificar(
  p_id_cliente        uuid,
  p_nombre_cliente    text,
  p_id_tipo_cliente   uuid,
  p_documento_cliente text,
  p_telefono_cliente  text,
  p_mail_cliente      text default null,
  p_direccion_cliente text default null
)
returns public.cliente
language plpgsql
set search_path to 'public'
as $$
declare
  v_nombre    text := btrim(p_nombre_cliente);
  v_documento text := btrim(p_documento_cliente);
  v_telefono  text := btrim(p_telefono_cliente);
  v_mail      text := nullif(btrim(p_mail_cliente), '');
  v_direccion text := nullif(btrim(p_direccion_cliente), '');
  v_actual    public.cliente;
  v_cliente   public.cliente;
begin
  select * into v_actual from public.cliente where id_cliente = p_id_cliente;

  if not found then
    raise exception 'No se encontró el cliente indicado'
      using errcode = 'CLI07';
  end if;

  if v_actual.es_consumidor_final then
    raise exception 'El cliente Consumidor Final no se puede modificar'
      using errcode = 'CLI08';
  end if;

  if v_nombre is null or length(v_nombre) = 0 then
    raise exception 'El nombre del cliente no puede estar vacío'
      using errcode = 'CLI01';
  end if;

  if p_id_tipo_cliente is null then
    raise exception 'Debe seleccionar el tipo de cliente'
      using errcode = 'CLI02';
  end if;

  -- Si cambia de tipo, el nuevo debe estar activo; si conserva el mismo, se permite aunque esté inhabilitado
  if p_id_tipo_cliente is distinct from v_actual.id_tipo_cliente then
    if not exists (
      select 1 from public.tipo_cliente
      where id_tipo_cliente = p_id_tipo_cliente and activo = true
    ) then
      raise exception 'El tipo de cliente indicado no existe o está inhabilitado'
        using errcode = 'CLI02';
    end if;
  end if;

  if v_documento is null or length(v_documento) = 0 then
    raise exception 'El documento (DNI o CUIT) no puede estar vacío'
      using errcode = 'CLI03';
  end if;

  if v_documento !~ '^[0-9]{7,8}$' and v_documento !~ '^[0-9]{2}-[0-9]{8}-[0-9]{1}$' then
    raise exception 'El documento debe ser un DNI (7 u 8 dígitos) o un CUIT con formato XX-XXXXXXXX-X'
      using errcode = 'CLI03';
  end if;

  if v_telefono is null or length(v_telefono) = 0 then
    raise exception 'El teléfono es obligatorio'
      using errcode = 'CLI04';
  end if;

  if v_telefono !~ '^[0-9]{6,15}$' then
    raise exception 'El teléfono debe tener entre 6 y 15 dígitos, sin espacios ni guiones'
      using errcode = 'CLI04';
  end if;

  if v_mail is not null and v_mail !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then
    raise exception 'El mail debe tener un formato válido'
      using errcode = 'CLI05';
  end if;

  if exists (
    select 1 from public.cliente
    where documento_cliente = v_documento and id_cliente <> p_id_cliente
  ) then
    raise exception 'Ya existe otro cliente con el documento "%"', v_documento
      using errcode = 'CLI06';
  end if;

  begin
    update public.cliente
    set nombre_cliente    = v_nombre,
        id_tipo_cliente   = p_id_tipo_cliente,
        documento_cliente = v_documento,
        telefono_cliente  = v_telefono,
        mail_cliente      = v_mail,
        direccion_cliente = v_direccion,
        editado           = now()
    where id_cliente = p_id_cliente
    returning * into v_cliente;
  exception
    when unique_violation then
      raise exception 'Ya existe otro cliente con el documento "%"', v_documento
        using errcode = 'CLI06';
  end;

  return v_cliente;
end;
$$;

create or replace function public.fn_cliente_habilitar(p_id_cliente uuid)
returns public.cliente
language plpgsql
set search_path to 'public'
as $$
declare
  v_cliente public.cliente;
begin
  if not exists (select 1 from public.cliente where id_cliente = p_id_cliente) then
    raise exception 'No se encontró el cliente indicado'
      using errcode = 'CLI07';
  end if;

  update public.cliente
  set activo = true,
      editado = now()
  where id_cliente = p_id_cliente
  returning * into v_cliente;

  return v_cliente;
end;
$$;

create or replace function public.fn_cliente_inhabilitar(p_id_cliente uuid)
returns public.cliente
language plpgsql
set search_path to 'public'
as $$
declare
  v_cliente public.cliente;
begin
  select * into v_cliente from public.cliente where id_cliente = p_id_cliente;

  if not found then
    raise exception 'No se encontró el cliente indicado'
      using errcode = 'CLI07';
  end if;

  if v_cliente.es_consumidor_final then
    raise exception 'El cliente Consumidor Final no se puede inhabilitar'
      using errcode = 'CLI08';
  end if;

  update public.cliente
  set activo = false,
      editado = now()
  where id_cliente = p_id_cliente
  returning * into v_cliente;

  return v_cliente;
end;
$$;

create or replace function public.fn_cliente_listar(p_incluir_inactivos boolean default true)
returns table(
  id_cliente          uuid,
  nombre_cliente      text,
  id_tipo_cliente     uuid,
  nombre_tipo_cliente text,
  lista_precio        public.tipo_lista_precio,
  documento_cliente   text,
  telefono_cliente    text,
  mail_cliente        text,
  direccion_cliente   text,
  es_consumidor_final boolean,
  activo              boolean,
  creado              timestamptz,
  editado             timestamptz,
  creado_por          uuid,
  creado_por_nombre   text
)
language sql
stable
set search_path to 'public'
as $$
  select
    c.id_cliente,
    c.nombre_cliente,
    c.id_tipo_cliente,
    t.nombre_tipo_cliente,
    t.lista_precio,
    c.documento_cliente,
    c.telefono_cliente,
    c.mail_cliente,
    c.direccion_cliente,
    c.es_consumidor_final,
    c.activo,
    c.creado,
    c.editado,
    c.creado_por,
    coalesce(ur.nombre_completo, 'Usuario no disponible') as creado_por_nombre
  from public.cliente c
  join public.tipo_cliente t on t.id_tipo_cliente = c.id_tipo_cliente
  left join public.vw_usuario_resumen ur on ur.id_usuario = c.creado_por
  where p_incluir_inactivos or c.activo = true
  order by c.nombre_cliente;
$$;
