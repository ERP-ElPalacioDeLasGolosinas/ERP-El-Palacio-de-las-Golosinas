-- S5-17p · Funciones del personal del ERP para tickets de soporte (funciones nuevas, no tocan existentes).
-- SECURITY DEFINER + es_personal_erp(): el cliente web no pasa el chequeo. Errcodes (siguen a TKT01…TKT06):
--   TKT07 solo personal del ERP · TKT08 transición de estado inválida
--   (reusa TKT05 ticket inexistente · TKT02 mensaje inválido · TKT06 ticket cerrado)
-- Responder: el ticket 'Abierto' o 'Resuelto' pasa a 'En proceso'; uno 'Cerrado' no admite respuestas.
-- Cambiar estado: cualquier estado distinto del actual, salvo que 'Cerrado' es final.

create or replace function public.fn_ticket_listar(p_estado public.estado_ticket default null)
returns table(
  id_ticket uuid,
  asunto text,
  estado text,
  id_cliente uuid,
  nombre_cliente text,
  id_pedido uuid,
  numero_pedido integer,
  creado timestamptz,
  ultima_actividad timestamptz
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null or not public.es_personal_erp() then
    raise exception 'Solo el personal del ERP puede ver los tickets' using errcode = 'TKT07';
  end if;

  return query
    select t.id_ticket, t.asunto, t.estado::text, t.id_cliente, c.nombre_cliente, t.id_pedido, pw.numero, t.creado,
           coalesce((select max(m.creado) from public.ticket_mensaje m where m.id_ticket = t.id_ticket), t.creado)
    from public.ticket_soporte t
    join public.cliente c on c.id_cliente = t.id_cliente
    left join public.pedido_web pw on pw.id_pedido = t.id_pedido
    where p_estado is null or t.estado = p_estado
    order by 9 desc;
end;
$function$;

create or replace function public.fn_ticket_obtener(p_id_ticket uuid)
returns table(
  id_ticket uuid,
  asunto text,
  estado text,
  id_cliente uuid,
  nombre_cliente text,
  mail_cliente text,
  telefono_cliente text,
  id_pedido uuid,
  numero_pedido integer,
  creado timestamptz,
  mensajes jsonb
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null or not public.es_personal_erp() then
    raise exception 'Solo el personal del ERP puede ver los tickets' using errcode = 'TKT07';
  end if;

  return query
    select t.id_ticket, t.asunto, t.estado::text, t.id_cliente, c.nombre_cliente, c.mail_cliente,
           c.telefono_cliente, t.id_pedido, pw.numero, t.creado,
           coalesce((
             select jsonb_agg(jsonb_build_object('autor', m.autor, 'mensaje', m.mensaje, 'fecha', m.creado)
                              order by m.creado, m.id_mensaje)
             from public.ticket_mensaje m where m.id_ticket = t.id_ticket
           ), '[]'::jsonb)
    from public.ticket_soporte t
    join public.cliente c on c.id_cliente = t.id_cliente
    left join public.pedido_web pw on pw.id_pedido = t.id_pedido
    where t.id_ticket = p_id_ticket;
end;
$function$;

create or replace function public.fn_ticket_responder_personal(
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
  if auth.uid() is null or not public.es_personal_erp() then
    raise exception 'Solo el personal del ERP puede responder tickets' using errcode = 'TKT07';
  end if;

  select t.estado into v_estado
  from public.ticket_soporte t
  where t.id_ticket = p_id_ticket
  for update;
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
  values (p_id_ticket, 'Personal', v_mensaje);

  if v_estado in ('Abierto', 'Resuelto') then
    update public.ticket_soporte set estado = 'En proceso' where id_ticket = p_id_ticket;
  else
    update public.ticket_soporte set editado = now() where id_ticket = p_id_ticket;
  end if;
end;
$function$;

create or replace function public.fn_ticket_cambiar_estado(
  p_id_ticket uuid,
  p_estado public.estado_ticket
) returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_estado public.estado_ticket;
begin
  if auth.uid() is null or not public.es_personal_erp() then
    raise exception 'Solo el personal del ERP puede cambiar el estado de un ticket' using errcode = 'TKT07';
  end if;

  select t.estado into v_estado
  from public.ticket_soporte t
  where t.id_ticket = p_id_ticket
  for update;
  if v_estado is null then
    raise exception 'El ticket no existe' using errcode = 'TKT05';
  end if;
  if v_estado = 'Cerrado' then
    raise exception 'El ticket está cerrado' using errcode = 'TKT06';
  end if;
  if v_estado = p_estado then
    raise exception 'El ticket ya está "%"', v_estado using errcode = 'TKT08';
  end if;

  update public.ticket_soporte set estado = p_estado where id_ticket = p_id_ticket;
end;
$function$;

revoke all on function public.fn_ticket_listar(public.estado_ticket) from public, anon;
revoke all on function public.fn_ticket_obtener(uuid) from public, anon;
revoke all on function public.fn_ticket_responder_personal(uuid, text) from public, anon;
revoke all on function public.fn_ticket_cambiar_estado(uuid, public.estado_ticket) from public, anon;
grant execute on function public.fn_ticket_listar(public.estado_ticket) to authenticated;
grant execute on function public.fn_ticket_obtener(uuid) to authenticated;
grant execute on function public.fn_ticket_responder_personal(uuid, text) to authenticated;
grant execute on function public.fn_ticket_cambiar_estado(uuid, public.estado_ticket) to authenticated;
