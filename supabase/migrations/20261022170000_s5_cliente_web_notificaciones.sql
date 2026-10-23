-- S5-19h · Notificaciones del cliente web, derivadas de pedido_web_historial_estado.
-- Solo agrega: una columna en cliente y 3 funciones nuevas. No toca funciones existentes.

alter table public.cliente
  add column if not exists notificaciones_vistas_hasta timestamptz;

-- Cantidad de avisos no leídos (cambios de estado posteriores a la última vez que las vio).
create or replace function public.fn_cliente_web_notificaciones_no_leidas()
returns integer
language sql
stable
security definer
set search_path to 'public'
as $$
  select count(*)::integer
  from public.pedido_web_historial_estado h
  join public.pedido_web pw on pw.id_pedido = h.id_pedido
  join public.cliente c on c.id_cliente = pw.id_cliente
  where c.id_usuario = auth.uid()
    and h.estado <> 'Pendiente de pago'
    and (c.notificaciones_vistas_hasta is null or h.fecha > c.notificaciones_vistas_hasta);
$$;

-- Avisos más recientes primero. El alta del pedido (Pendiente de pago) no es un aviso.
create or replace function public.fn_cliente_web_notificaciones_listar(p_limite integer default 50)
returns table(id_historial uuid, id_pedido uuid, numero integer, estado text, fecha timestamptz, leida boolean)
language sql
stable
security definer
set search_path to 'public'
as $$
  select h.id_historial, h.id_pedido, pw.numero, h.estado::text, h.fecha,
         (c.notificaciones_vistas_hasta is not null and h.fecha <= c.notificaciones_vistas_hasta)
  from public.pedido_web_historial_estado h
  join public.pedido_web pw on pw.id_pedido = h.id_pedido
  join public.cliente c on c.id_cliente = pw.id_cliente
  where c.id_usuario = auth.uid()
    and h.estado <> 'Pendiente de pago'
  order by h.fecha desc
  limit greatest(coalesce(p_limite, 50), 1);
$$;

-- Marca todo lo existente como visto.
create or replace function public.fn_cliente_web_notificaciones_marcar_vistas()
returns void
language sql
volatile
security definer
set search_path to 'public'
as $$
  update public.cliente
     set notificaciones_vistas_hasta = now()
   where id_usuario = auth.uid();
$$;

revoke all on function public.fn_cliente_web_notificaciones_no_leidas() from public, anon;
revoke all on function public.fn_cliente_web_notificaciones_listar(integer) from public, anon;
revoke all on function public.fn_cliente_web_notificaciones_marcar_vistas() from public, anon;
grant execute on function public.fn_cliente_web_notificaciones_no_leidas() to authenticated, service_role;
grant execute on function public.fn_cliente_web_notificaciones_listar(integer) to authenticated, service_role;
grant execute on function public.fn_cliente_web_notificaciones_marcar_vistas() to authenticated, service_role;
