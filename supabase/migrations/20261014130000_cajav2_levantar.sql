-- EXPERIMENTAL cajav2 · El gerente levanta una caja para un empleado (sin paso
-- Pendiente) y el panel suma datos para las tarjetas. Solo objetos cajav2: se
-- borran con supabase/rollback/cajav2_drop.sql.
--
-- Solo se asignan usuarios 'Empleado Ventas' sin sesion viva, en los dos caminos
-- (el gerente levanta / el empleado pide).

-- usuario tiene RLS: el chequeo de rol de otro usuario necesita security definer.
create function public.fn_cajav2_es_empleado_ventas(p_id_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.usuario
    where id_usuario = p_id_usuario and rol_usuario = 'Empleado Ventas'
  );
$$;

revoke execute on function public.fn_cajav2_es_empleado_ventas(uuid) from public, anon;
grant execute on function public.fn_cajav2_es_empleado_ventas(uuid) to authenticated, service_role;

-- Empleados de ventas sin sesion viva (anti-join).
create function public.fn_cajav2_empleados_disponibles()
returns table (id_usuario uuid, nombre_completo text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select u.id_usuario, coalesce(v.nombre_completo, u.nombre_usuario || ' ' || u.apellido_usuario)
  from public.usuario u
  left join public.vw_usuario_resumen v on v.id_usuario = u.id_usuario
  where u.rol_usuario = 'Empleado Ventas'
    and not exists (
      select 1 from public.cajav2_sesion s
      where s.id_empleado = u.id_usuario
        and s.estado in ('Pendiente', 'Abierta', 'Cierre solicitado')
    )
  order by 2;
$$;

revoke execute on function public.fn_cajav2_empleados_disponibles() from public, anon;
grant execute on function public.fn_cajav2_empleados_disponibles() to authenticated, service_role;

create function public.fn_cajav2_levantar(
  p_id_registradora uuid,
  p_id_empleado uuid,
  p_monto_inicial numeric,
  p_observaciones text
)
returns public.cajav2_sesion
language plpgsql
set search_path to 'public'
as $$
declare
  v_reg    public.cajav2_registradora;
  v_sesion public.cajav2_sesion;
  v_caja   public.caja;
begin
  if not public.fn_cajav2_es_gerente() then
    raise exception 'Solo el gerente puede levantar una caja' using errcode = 'CJV01';
  end if;
  if p_monto_inicial is null or p_monto_inicial < 0 then
    raise exception 'El monto inicial en efectivo es obligatorio y no puede ser negativo' using errcode = 'CJV02';
  end if;

  select * into v_reg from public.cajav2_registradora where id_registradora = p_id_registradora;
  if v_reg.id_registradora is null or not v_reg.activa then
    raise exception 'La caja elegida no existe o esta inactiva' using errcode = 'CJV02';
  end if;
  if not exists (select 1 from public.deposito where id_deposito = v_reg.id_deposito and activo) then
    raise exception 'El deposito de la caja esta inactivo' using errcode = 'CJV02';
  end if;
  if p_id_empleado is null or not public.fn_cajav2_es_empleado_ventas(p_id_empleado) then
    raise exception 'Elegi un empleado de ventas' using errcode = 'CJV02';
  end if;
  if exists (
    select 1 from public.cajav2_sesion
    where (id_registradora = p_id_registradora or id_empleado = p_id_empleado)
      and estado in ('Pendiente', 'Abierta', 'Cierre solicitado')
  ) then
    raise exception 'La caja esta ocupada o el empleado ya tiene una sesion activa' using errcode = 'CJV03';
  end if;

  insert into public.caja (punto_venta, id_deposito, monto_inicial, abierta_por, observaciones_apertura)
  values (v_reg.numero, v_reg.id_deposito, round(p_monto_inicial, 2), p_id_empleado, nullif(btrim(p_observaciones), ''))
  returning * into v_caja;

  insert into public.cajav2_sesion (
    id_registradora, id_empleado, estado, monto_inicial, observaciones_apertura,
    autorizada_por, fecha_autorizacion, id_caja
  ) values (
    p_id_registradora, p_id_empleado, 'Abierta', round(p_monto_inicial, 2), nullif(btrim(p_observaciones), ''),
    auth.uid(), now(), v_caja.id_caja
  )
  returning * into v_sesion;

  return v_sesion;
exception
  when unique_violation then
    raise exception 'La caja esta ocupada o el empleado ya tiene una sesion activa' using errcode = 'CJV03';
end;
$$;

-- Mismo criterio de rol cuando el empleado pide la apertura.
create or replace function public.fn_cajav2_solicitar_apertura(
  p_id_registradora uuid,
  p_monto_inicial numeric,
  p_observaciones text
)
returns public.cajav2_sesion
language plpgsql
set search_path to 'public'
as $$
declare
  v_reg    public.cajav2_registradora;
  v_sesion public.cajav2_sesion;
  v_otra   integer;
begin
  if not public.fn_cajav2_es_empleado_ventas(auth.uid()) then
    raise exception 'Solo un empleado de ventas puede pedir una caja' using errcode = 'CJV06';
  end if;
  if p_monto_inicial is null or p_monto_inicial < 0 then
    raise exception 'El monto inicial en efectivo es obligatorio y no puede ser negativo' using errcode = 'CJV02';
  end if;

  select * into v_reg from public.cajav2_registradora where id_registradora = p_id_registradora;
  if v_reg.id_registradora is null or not v_reg.activa then
    raise exception 'La caja elegida no existe o esta inactiva' using errcode = 'CJV02';
  end if;

  select r.numero into v_otra
  from public.cajav2_sesion s
  join public.cajav2_registradora r on r.id_registradora = s.id_registradora
  where s.id_empleado = auth.uid()
    and s.estado in ('Pendiente', 'Abierta', 'Cierre solicitado');
  if v_otra is not null then
    raise exception 'Ya tenes una sesion activa en la caja %', v_otra using errcode = 'CJV03';
  end if;

  if exists (
    select 1 from public.cajav2_sesion
    where id_registradora = p_id_registradora
      and estado in ('Pendiente', 'Abierta', 'Cierre solicitado')
  ) then
    raise exception 'La caja % esta ocupada', v_reg.numero using errcode = 'CJV03';
  end if;

  insert into public.cajav2_sesion (id_registradora, id_empleado, monto_inicial, observaciones_apertura)
  values (p_id_registradora, auth.uid(), round(p_monto_inicial, 2), nullif(btrim(p_observaciones), ''))
  returning * into v_sesion;

  return v_sesion;
exception
  when unique_violation then
    raise exception 'La caja esta ocupada o ya tenes una sesion activa' using errcode = 'CJV03';
end;
$$;

-- Panel: suma egresos y cantidad de ventas de la sesion para las tarjetas.
create or replace function public.fn_cajav2_panel()
returns jsonb
language sql
stable
set search_path to 'public'
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id_registradora', r.id_registradora,
    'numero', r.numero,
    'nombre', r.nombre,
    'activa', r.activa,
    'id_deposito', r.id_deposito,
    'nombre_deposito', d.nombre_deposito,
    'sesion', case when v.id_sesion is null then null else to_jsonb(v) || jsonb_build_object(
      'saldo_efectivo', (res.resumen->'efectivo'->>'saldo_teorico')::numeric,
      'total_ingresos', (res.resumen->>'total_ingresos')::numeric,
      'total_egresos', (res.resumen->>'total_egresos')::numeric,
      'cantidad_ventas', (
        select count(distinct m.id_comprobante)
        from public.movimiento_caja m
        where m.id_caja = v.id_caja and m.id_comprobante is not null
      )
    ) end
  ) order by r.numero), '[]'::jsonb)
  from public.cajav2_registradora r
  join public.deposito d on d.id_deposito = r.id_deposito
  left join public.cajav2_vw_sesion v
    on v.id_registradora = r.id_registradora
   and v.estado in ('Pendiente', 'Abierta', 'Cierre solicitado')
  left join lateral (
    select case when v.id_caja is null then null else public.fn_caja_resumen(v.id_caja) end as resumen
  ) res on true;
$$;

notify pgrst, 'reload schema';
