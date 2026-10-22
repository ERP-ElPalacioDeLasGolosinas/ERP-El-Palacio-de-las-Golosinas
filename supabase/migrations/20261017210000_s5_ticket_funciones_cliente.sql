-- S5-17m · Funciones del cliente web para tickets de soporte (funciones nuevas, no tocan existentes).
-- Todas SECURITY DEFINER: el cliente no tiene política sobre las tablas (D-030) y se identifica por
-- cliente.id_usuario = auth.uid(). Errcodes:
--   TKT01 asunto inválido (1-150) · TKT02 mensaje inválido (1-2000) · TKT03 pedido ajeno/inexistente
--   TKT04 no hay cliente web activo · TKT05 ticket inexistente o ajeno · TKT06 ticket cerrado
-- Responder un ticket 'Resuelto' lo reabre ('Abierto'); uno 'Cerrado' no admite respuestas.

create or replace function public.fn_ticket_crear(
  p_asunto text,
  p_mensaje text,
  p_id_pedido uuid default null
) returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id_cliente uuid;
  v_asunto  text := btrim(coalesce(p_asunto, ''));
  v_mensaje text := btrim(coalesce(p_mensaje, ''));
  v_id_ticket uuid;
begin
  select c.id_cliente into v_id_cliente
  from public.cliente c where c.id_usuario = auth.uid() and c.activo = true;
  if v_id_cliente is null then
    raise exception 'No hay un cliente web activo para esta sesión' using errcode = 'TKT04';
  end if;
  if length(v_asunto) not between 1 and 150 then
    raise exception 'El asunto debe tener entre 1 y 150 caracteres' using errcode = 'TKT01';
  end if;
  if length(v_mensaje) not between 1 and 2000 then
    raise exception 'El mensaje debe tener entre 1 y 2000 caracteres' using errcode = 'TKT02';
  end if;
  if p_id_pedido is not null and not exists (
    select 1 from public.pedido_web pw
    where pw.id_pedido = p_id_pedido and pw.id_cliente = v_id_cliente
  ) then
    raise exception 'El pedido indicado no existe' using errcode = 'TKT03';
  end if;

  insert into public.ticket_soporte (id_cliente, id_pedido, asunto)
  values (v_id_cliente, p_id_pedido, v_asunto)
  returning id_ticket into v_id_ticket;

  insert into public.ticket_mensaje (id_ticket, autor, mensaje)
  values (v_id_ticket, 'Cliente', v_mensaje);

  return v_id_ticket;
end;
$function$;

create or replace function public.fn_ticket_mis_listar()
returns table(
  id_ticket uuid,
  asunto text,
  estado text,
  id_pedido uuid,
  numero_pedido integer,
  creado timestamptz,
  ultima_actividad timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select t.id_ticket, t.asunto, t.estado::text, t.id_pedido, pw.numero, t.creado,
         coalesce((select max(m.creado) from public.ticket_mensaje m where m.id_ticket = t.id_ticket), t.creado)
  from public.ticket_soporte t
  join public.cliente c on c.id_cliente = t.id_cliente
  left join public.pedido_web pw on pw.id_pedido = t.id_pedido
  where c.id_usuario = auth.uid()
  order by 7 desc;
$function$;

create or replace function public.fn_ticket_mi_obtener(p_id_ticket uuid)
returns table(
  id_ticket uuid,
  asunto text,
  estado text,
  id_pedido uuid,
  numero_pedido integer,
  creado timestamptz,
  mensajes jsonb
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select t.id_ticket, t.asunto, t.estado::text, t.id_pedido, pw.numero, t.creado,
         coalesce((
           select jsonb_agg(jsonb_build_object('autor', m.autor, 'mensaje', m.mensaje, 'fecha', m.creado)
                            order by m.creado, m.id_mensaje)
           from public.ticket_mensaje m where m.id_ticket = t.id_ticket
         ), '[]'::jsonb)
  from public.ticket_soporte t
  join public.cliente c on c.id_cliente = t.id_cliente
  left join public.pedido_web pw on pw.id_pedido = t.id_pedido
  where t.id_ticket = p_id_ticket and c.id_usuario = auth.uid();
$function$;

create or replace function public.fn_ticket_responder_cliente(
  p_id_ticket uuid,
  p_mensaje text
) returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_estado  public.estado_ticket;
  v_mensaje text := btrim(coalesce(p_mensaje, ''));
begin
  select t.estado into v_estado
  from public.ticket_soporte t
  join public.cliente c on c.id_cliente = t.id_cliente
  where t.id_ticket = p_id_ticket and c.id_usuario = auth.uid() and c.activo = true
  for update of t;
  if v_estado is null then
    raise exception 'El ticket no existe' using errcode = 'TKT05';
  end if;
  if v_estado = 'Cerrado' then
    raise exception 'El ticket está cerrado' using errcode = 'TKT06';
  end if;
  if length(v_mensaje) not between 1 and 2000 then
    raise exception 'El mensaje debe tener entre 1 y 2000 caracteres' using errcode = 'TKT02';
  end if;

  insert into public.ticket_mensaje (id_ticket, autor, mensaje)
  values (p_id_ticket, 'Cliente', v_mensaje);

  if v_estado = 'Resuelto' then
    update public.ticket_soporte set estado = 'Abierto' where id_ticket = p_id_ticket;
  else
    update public.ticket_soporte set editado = now() where id_ticket = p_id_ticket;
  end if;
end;
$function$;

revoke all on function public.fn_ticket_crear(text, text, uuid) from public, anon;
revoke all on function public.fn_ticket_mis_listar() from public, anon;
revoke all on function public.fn_ticket_mi_obtener(uuid) from public, anon;
revoke all on function public.fn_ticket_responder_cliente(uuid, text) from public, anon;
grant execute on function public.fn_ticket_crear(text, text, uuid) to authenticated;
grant execute on function public.fn_ticket_mis_listar() to authenticated;
grant execute on function public.fn_ticket_mi_obtener(uuid) to authenticated;
grant execute on function public.fn_ticket_responder_cliente(uuid, text) to authenticated;
