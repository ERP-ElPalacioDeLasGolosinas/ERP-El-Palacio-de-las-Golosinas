-- Historial de cajas: filtro por deposito y por el empleado que la atendio.

drop function if exists public.fn_caja_listar(date, date, public.estado_caja);

create function public.fn_caja_listar(
  p_desde date default null,
  p_hasta date default null,
  p_estado public.estado_caja default null,
  p_id_deposito uuid default null,
  p_id_empleado uuid default null
)
returns table (
  id_caja uuid,
  punto_venta integer,
  id_deposito uuid,
  nombre_deposito text,
  estado public.estado_caja,
  monto_inicial numeric,
  fecha_apertura timestamptz,
  abierta_por_nombre text,
  fecha_cierre timestamptz,
  cerrada_por_nombre text,
  total_ingresos numeric,
  total_egresos numeric,
  saldo_teorico_efectivo numeric,
  saldo_fisico_efectivo numeric,
  diferencia_efectivo numeric,
  cantidad_movimientos bigint
)
language sql
stable
set search_path to 'public'
as $$
  select
    c.id_caja,
    c.punto_venta,
    c.id_deposito,
    d.nombre_deposito,
    c.estado,
    c.monto_inicial,
    c.fecha_apertura,
    coalesce(ua.nombre_completo, 'Usuario no disponible'),
    c.fecha_cierre,
    uc.nombre_completo,
    coalesce(c.total_ingresos, m.ingresos),
    coalesce(c.total_egresos, m.egresos),
    c.saldo_teorico_efectivo,
    c.saldo_fisico_efectivo,
    c.diferencia_efectivo,
    m.cantidad
  from public.caja c
  left join public.deposito d on d.id_deposito = c.id_deposito
  left join public.vw_usuario_resumen ua on ua.id_usuario = c.abierta_por
  left join public.vw_usuario_resumen uc on uc.id_usuario = c.cerrada_por
  cross join lateral (
    select coalesce(sum(case when mc.tipo = 'Ingreso' then mc.importe end), 0) as ingresos,
           coalesce(sum(case when mc.tipo = 'Egreso' then mc.importe end), 0) as egresos,
           count(mc.*) as cantidad
    from public.movimiento_caja mc
    where mc.id_caja = c.id_caja
  ) m
  where (p_desde is null or (c.fecha_apertura at time zone 'America/Argentina/Buenos_Aires')::date >= p_desde)
    and (p_hasta is null or (c.fecha_apertura at time zone 'America/Argentina/Buenos_Aires')::date <= p_hasta)
    and (p_estado is null or c.estado = p_estado)
    and (p_id_deposito is null or c.id_deposito = p_id_deposito)
    and (p_id_empleado is null or c.abierta_por = p_id_empleado)
  order by c.fecha_apertura desc;
$$;

revoke execute on function public.fn_caja_listar(date, date, public.estado_caja, uuid, uuid) from public, anon;
grant execute on function public.fn_caja_listar(date, date, public.estado_caja, uuid, uuid) to authenticated, service_role;

create or replace function public.fn_usuario_buscar(p_busqueda text)
returns table (
  id_usuario uuid,
  nombre_completo text
)
language sql
stable
set search_path to 'public'
as $$
  select u.id_usuario, u.nombre_completo
  from public.vw_usuario_resumen u
  where length(btrim(coalesce(p_busqueda, ''))) >= 2
    and u.nombre_completo ilike '%' || btrim(p_busqueda) || '%'
  order by u.nombre_completo
  limit 8;
$$;

revoke execute on function public.fn_usuario_buscar(text) from public, anon;
grant execute on function public.fn_usuario_buscar(text) to authenticated, service_role;

notify pgrst, 'reload schema';
