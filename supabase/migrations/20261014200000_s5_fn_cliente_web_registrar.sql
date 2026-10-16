-- S5-1b (U-06): alta del cliente web. Se llama con la sesion del usuario recien registrado
-- en Supabase Auth; crea el `cliente` tipo Minorista enlazado a auth.uid() (D-030: creado_por NULL).
-- Errcodes: CLW01 nombre, CLW02 documento, CLW03 telefono, CLW04 ya registrado / sin sesion o es
-- personal del ERP, CLW05 documento ya usado, CLW06 mail invalido, CLW07 tipo Minorista inexistente.
create or replace function public.fn_cliente_web_registrar(
  p_nombre_cliente text,
  p_documento_cliente text,
  p_telefono_cliente text,
  p_direccion_cliente text default null
)
returns public.cliente
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_nombre    text := btrim(p_nombre_cliente);
  v_documento text := btrim(p_documento_cliente);
  v_telefono  text := btrim(p_telefono_cliente);
  v_direccion text := nullif(btrim(p_direccion_cliente), '');
  v_mail      text;
  v_tipo      uuid;
  v_cliente   public.cliente;
begin
  if v_uid is null then
    raise exception 'Debe iniciar sesión para registrarse' using errcode = 'CLW04';
  end if;
  if exists (select 1 from public.usuario where id_usuario = v_uid) then
    raise exception 'Una cuenta del ERP no puede registrarse como cliente web' using errcode = 'CLW04';
  end if;
  if exists (select 1 from public.cliente where id_usuario = v_uid) then
    raise exception 'Esta cuenta ya está registrada como cliente' using errcode = 'CLW04';
  end if;

  if v_nombre is null or length(v_nombre) = 0 then
    raise exception 'El nombre no puede estar vacío' using errcode = 'CLW01';
  end if;
  if v_documento is null or (v_documento !~ '^[0-9]{7,8}$' and v_documento !~ '^[0-9]{2}-[0-9]{8}-[0-9]{1}$') then
    raise exception 'El documento debe ser un DNI (7 u 8 dígitos) o un CUIT con formato XX-XXXXXXXX-X'
      using errcode = 'CLW02';
  end if;
  if v_telefono is null or v_telefono !~ '^[0-9]{6,15}$' then
    raise exception 'El teléfono debe tener entre 6 y 15 dígitos' using errcode = 'CLW03';
  end if;

  select email into v_mail from auth.users where id = v_uid;

  select id_tipo_cliente into v_tipo
  from public.tipo_cliente
  where nombre_tipo_cliente = 'Minorista' and activo = true;
  if v_tipo is null then
    raise exception 'No existe el tipo de cliente Minorista activo' using errcode = 'CLW07';
  end if;

  begin
    insert into public.cliente (
      nombre_cliente, id_tipo_cliente, documento_cliente, telefono_cliente,
      mail_cliente, direccion_cliente, creado_por, id_usuario
    ) values (
      v_nombre, v_tipo, v_documento, v_telefono, v_mail, v_direccion, null, v_uid
    ) returning * into v_cliente;
  exception
    when unique_violation then
      raise exception 'Ya existe un cliente con ese documento' using errcode = 'CLW05';
    when check_violation then
      raise exception 'El mail de la cuenta no es válido para registrarse' using errcode = 'CLW06';
  end;

  return v_cliente;
end;
$$;

revoke all on function public.fn_cliente_web_registrar(text, text, text, text) from public, anon;
grant execute on function public.fn_cliente_web_registrar(text, text, text, text) to authenticated;
