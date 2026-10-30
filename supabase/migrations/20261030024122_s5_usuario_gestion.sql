-- S5 · Gestión de usuarios (U-0x): el Gerente lista, edita, habilita/inhabilita y elimina empleados
-- (Empleado Deposito / Compras / Ventas). Los gerentes no se gestionan desde acá.
-- El alta sigue en la edge function `crear-usuario` (necesita service role para crear la cuenta de Auth).
--  * usuario.activo (default true). Inhabilitar banea la cuenta de Auth (banned_until) y corta sus
--    sesiones; habilitar lo revierte. Login rechaza al baneado.
--  * fn_usuario_eliminar borra la cuenta de Auth (la fila de usuario cae por ON DELETE CASCADE). Si el
--    empleado tiene operaciones registradas, las FK lo impiden y se sugiere inhabilitar (USR11).
--  * fn_sesion_caja_empleados_disponibles deja de ofrecer empleados inactivos.
-- Funciones SECURITY DEFINER (tocan auth.users / auth.sessions) con chequeo de Gerente al inicio.
-- Errcodes: USR01 solo gerente · USR02 nombre/apellido vacío · USR03 DNI inválido · USR04 DNI duplicado
-- USR05 usuario inexistente · USR06 no es un empleado gestionable · USR07 rol inválido · USR08 fecha de
-- nacimiento inválida · USR09 teléfono inválido · USR10 tiene una caja activa · USR11 tiene operaciones.
-- Reversión: drop de las funciones fn_usuario_* nuevas, alter table usuario drop column activo,
-- reaplicar fn_sesion_caja_empleados_disponibles sin el filtro y
-- update auth.users set banned_until = null where banned_until is not null.

alter table public.usuario
  add column if not exists activo boolean not null default true;

-- Valida que quien llama sea Gerente y que el destino sea un empleado existente (no gerente).
create or replace function public._fn_usuario_validar_gestion(p_id_usuario uuid)
returns public.usuario
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_usuario public.usuario;
begin
  if not public.fn_caja_es_gerente() then
    raise exception 'Solo el gerente puede gestionar usuarios'
      using errcode = 'USR01';
  end if;

  select * into v_usuario from public.usuario where id_usuario = p_id_usuario;
  if v_usuario.id_usuario is null then
    raise exception 'No se encontró el usuario indicado'
      using errcode = 'USR05';
  end if;

  if v_usuario.rol_usuario = 'Gerente' then
    raise exception 'Desde acá solo se gestionan empleados de depósito, compras y ventas'
      using errcode = 'USR06';
  end if;

  return v_usuario;
end;
$function$;

-- Un empleado de ventas con una sesión de caja en curso no se inhabilita ni cambia de rol.
create or replace function public._fn_usuario_validar_sin_caja(p_id_usuario uuid)
returns void
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if exists (
    select 1 from public.sesion_caja
    where id_empleado = p_id_usuario
      and estado in ('Pendiente', 'Abierta', 'Cierre solicitado')
  ) then
    raise exception 'El empleado tiene una caja en curso. Cerrala antes de continuar.'
      using errcode = 'USR10';
  end if;
end;
$function$;

create or replace function public.fn_usuario_listar(p_incluir_inactivos boolean default true)
returns table(
  id_usuario uuid, nombre_usuario text, apellido_usuario text, nombre_completo text,
  fecha_nacimiento_usuario date, dni_usuario integer, telefono_usuario text, mail_usuario text,
  rol_usuario public.rol_usuario_enum, activo boolean, creado timestamp with time zone,
  editado timestamp with time zone, ultimo_ingreso timestamp with time zone
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not public.fn_caja_es_gerente() then
    raise exception 'Solo el gerente puede gestionar usuarios'
      using errcode = 'USR01';
  end if;

  return query
  select
    u.id_usuario, u.nombre_usuario, u.apellido_usuario,
    u.nombre_usuario || ' ' || u.apellido_usuario as nombre_completo,
    u.fecha_nacimiento_usuario, u.dni_usuario, u.telefono_usuario, u.mail_usuario,
    u.rol_usuario, u.activo, u.creado, u.editado,
    au.last_sign_in_at as ultimo_ingreso
  from public.usuario u
  left join auth.users au on au.id = u.id_usuario
  where u.rol_usuario <> 'Gerente'
    and (p_incluir_inactivos or u.activo = true)
  order by u.apellido_usuario, u.nombre_usuario;
end;
$function$;

create or replace function public.fn_usuario_modificar(
  p_id_usuario uuid,
  p_nombre_usuario text,
  p_apellido_usuario text,
  p_fecha_nacimiento_usuario date,
  p_dni_usuario integer,
  p_telefono_usuario text,
  p_rol_usuario public.rol_usuario_enum
)
returns public.usuario
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_actual   public.usuario;
  v_nombre   text := btrim(p_nombre_usuario);
  v_apellido text := btrim(p_apellido_usuario);
  v_telefono text := btrim(p_telefono_usuario);
  v_usuario  public.usuario;
begin
  v_actual := public._fn_usuario_validar_gestion(p_id_usuario);

  if v_nombre is null or length(v_nombre) = 0 or v_apellido is null or length(v_apellido) = 0 then
    raise exception 'El nombre y el apellido son obligatorios'
      using errcode = 'USR02';
  end if;

  if p_dni_usuario is null or p_dni_usuario < 1000000 or p_dni_usuario > 99999999 then
    raise exception 'El DNI debe tener entre 7 y 8 dígitos'
      using errcode = 'USR03';
  end if;

  if exists (
    select 1 from public.usuario
    where dni_usuario = p_dni_usuario and id_usuario <> p_id_usuario
  ) then
    raise exception 'Ya existe otro usuario con el DNI %', p_dni_usuario
      using errcode = 'USR04';
  end if;

  if p_rol_usuario is null or p_rol_usuario = 'Gerente' then
    raise exception 'Elegí un rol de empleado: depósito, compras o ventas'
      using errcode = 'USR07';
  end if;

  if p_fecha_nacimiento_usuario is null
     or p_fecha_nacimiento_usuario > (current_date - interval '16 years')::date then
    raise exception 'La fecha de nacimiento no es válida (el empleado debe tener al menos 16 años)'
      using errcode = 'USR08';
  end if;

  if v_telefono is null or v_telefono !~ '^\d{6,15}$' then
    raise exception 'El teléfono debe tener entre 6 y 15 dígitos'
      using errcode = 'USR09';
  end if;

  if v_actual.rol_usuario = 'Empleado Ventas' and p_rol_usuario <> 'Empleado Ventas' then
    perform public._fn_usuario_validar_sin_caja(p_id_usuario);
  end if;

  update public.usuario
  set nombre_usuario = v_nombre,
      apellido_usuario = v_apellido,
      fecha_nacimiento_usuario = p_fecha_nacimiento_usuario,
      dni_usuario = p_dni_usuario,
      telefono_usuario = v_telefono,
      rol_usuario = p_rol_usuario,
      editado = now()
  where id_usuario = p_id_usuario
  returning * into v_usuario;

  return v_usuario;
end;
$function$;

create or replace function public.fn_usuario_habilitar(p_id_usuario uuid)
returns public.usuario
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_usuario public.usuario;
begin
  perform public._fn_usuario_validar_gestion(p_id_usuario);

  update auth.users set banned_until = null where id = p_id_usuario;

  update public.usuario
  set activo = true,
      editado = now()
  where id_usuario = p_id_usuario
  returning * into v_usuario;

  return v_usuario;
end;
$function$;

create or replace function public.fn_usuario_inhabilitar(p_id_usuario uuid)
returns public.usuario
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_usuario public.usuario;
begin
  perform public._fn_usuario_validar_gestion(p_id_usuario);
  perform public._fn_usuario_validar_sin_caja(p_id_usuario);

  -- Baneo sin vencimiento práctico (GoTrue no acepta 'infinity') y cierre de las sesiones abiertas.
  update auth.users set banned_until = '2999-12-31 00:00:00+00' where id = p_id_usuario;
  delete from auth.sessions where user_id = p_id_usuario;

  update public.usuario
  set activo = false,
      editado = now()
  where id_usuario = p_id_usuario
  returning * into v_usuario;

  return v_usuario;
end;
$function$;

create or replace function public.fn_usuario_eliminar(p_id_usuario uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  perform public._fn_usuario_validar_gestion(p_id_usuario);
  perform public._fn_usuario_validar_sin_caja(p_id_usuario);

  begin
    -- La fila de usuario se borra en cascada desde la cuenta de Auth.
    delete from auth.users where id = p_id_usuario;
  exception
    when foreign_key_violation then
      raise exception 'No se puede eliminar: el empleado tiene operaciones registradas. Solo puede inhabilitarse.'
        using errcode = 'USR11';
  end;
end;
$function$;

create or replace function public.fn_sesion_caja_empleados_disponibles()
returns table(id_usuario uuid, nombre_completo text)
language sql
stable
set search_path to 'public'
as $function$
  select u.id_usuario, coalesce(v.nombre_completo, u.nombre_usuario || ' ' || u.apellido_usuario)
  from public.usuario u
  left join public.vw_usuario_resumen v on v.id_usuario = u.id_usuario
  where u.rol_usuario = 'Empleado Ventas'
    and u.activo
    and not exists (
      select 1 from public.sesion_caja s
      where s.id_empleado = u.id_usuario
        and s.estado in ('Pendiente', 'Abierta', 'Cierre solicitado')
    )
  order by 2;
$function$;

revoke all on function public._fn_usuario_validar_gestion(uuid) from public, anon, authenticated;
revoke all on function public._fn_usuario_validar_sin_caja(uuid) from public, anon, authenticated;
revoke all on function public.fn_usuario_listar(boolean) from public, anon;
revoke all on function public.fn_usuario_modificar(uuid, text, text, date, integer, text, public.rol_usuario_enum) from public, anon;
revoke all on function public.fn_usuario_habilitar(uuid) from public, anon;
revoke all on function public.fn_usuario_inhabilitar(uuid) from public, anon;
revoke all on function public.fn_usuario_eliminar(uuid) from public, anon;
grant execute on function public.fn_usuario_listar(boolean) to authenticated, service_role;
grant execute on function public.fn_usuario_modificar(uuid, text, text, date, integer, text, public.rol_usuario_enum) to authenticated, service_role;
grant execute on function public.fn_usuario_habilitar(uuid) to authenticated, service_role;
grant execute on function public.fn_usuario_inhabilitar(uuid) to authenticated, service_role;
grant execute on function public.fn_usuario_eliminar(uuid) to authenticated, service_role;
