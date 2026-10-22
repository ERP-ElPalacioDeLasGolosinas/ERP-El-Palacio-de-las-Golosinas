-- S5-17j: el cliente web edita sus datos desde "Mi cuenta".
-- Función nueva (no toca las existentes). Mismas validaciones que fn_cliente_web_completar_datos,
-- más el nombre (CLW01). La dirección es opcional: vacía la deja en NULL. El mail no se edita.

create or replace function public.fn_cliente_web_actualizar_datos(
  p_nombre_cliente    text,
  p_telefono_cliente  text,
  p_direccion_cliente text,
  p_documento_cliente text
) returns public.cliente
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id_cliente uuid;
  v_nombre     text := nullif(btrim(p_nombre_cliente), '');
  v_documento  text := nullif(btrim(p_documento_cliente), '');
  v_telefono   text := nullif(btrim(p_telefono_cliente), '');
  v_direccion  text := nullif(btrim(p_direccion_cliente), '');
  v_cliente    public.cliente;
begin
  select c.id_cliente into v_id_cliente
  from public.cliente c
  where c.id_usuario = auth.uid() and c.activo = true;
  if v_id_cliente is null then
    raise exception 'No hay un cliente web activo para esta sesión' using errcode = 'CLW08';
  end if;

  if v_nombre is null then
    raise exception 'El nombre no puede estar vacío' using errcode = 'CLW01';
  end if;
  if v_documento is null
     or (v_documento !~ '^[0-9]{7,8}$' and v_documento !~ '^[0-9]{2}-[0-9]{8}-[0-9]{1}$') then
    raise exception 'El documento debe ser un DNI (7 u 8 dígitos) o un CUIT con formato XX-XXXXXXXX-X'
      using errcode = 'CLW02';
  end if;
  if v_telefono is null or v_telefono !~ '^[0-9]{6,15}$' then
    raise exception 'El teléfono debe tener entre 6 y 15 dígitos' using errcode = 'CLW03';
  end if;

  begin
    update public.cliente
    set nombre_cliente    = v_nombre,
        documento_cliente = v_documento,
        telefono_cliente  = v_telefono,
        direccion_cliente = v_direccion,
        editado = now()
    where id_cliente = v_id_cliente
    returning * into v_cliente;
  exception
    when unique_violation then
      raise exception 'Ya existe un cliente con ese documento' using errcode = 'CLW05';
  end;

  return v_cliente;
end;
$function$;

revoke all on function public.fn_cliente_web_actualizar_datos(text, text, text, text) from public, anon;
grant execute on function public.fn_cliente_web_actualizar_datos(text, text, text, text) to authenticated;
