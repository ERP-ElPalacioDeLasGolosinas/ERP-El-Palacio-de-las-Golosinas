-- S5-17l · Tickets de soporte (cliente web <-> personal del ERP).
-- Solo esquema: enum + tablas + RLS. Las funciones llegan en S5-17m (cliente) y S5-17p (personal).
-- RLS según D-030: el personal accede por política (es_personal_erp()); el cliente web NO tiene
-- política y accede solo por funciones SECURITY DEFINER. Sin DELETE: los tickets no se borran.

create type public.estado_ticket as enum ('Abierto', 'En proceso', 'Resuelto', 'Cerrado');

create table public.ticket_soporte (
  id_ticket   uuid primary key default gen_random_uuid(),
  id_cliente  uuid not null references public.cliente (id_cliente),
  id_pedido   uuid references public.pedido_web (id_pedido),
  asunto      text not null,
  estado      public.estado_ticket not null default 'Abierto',
  creado      timestamptz not null default now(),
  editado     timestamptz not null default now(),
  creado_por  uuid default auth.uid(),
  constraint ticket_soporte_asunto_chk check (length(btrim(asunto)) between 1 and 150)
);

create index ticket_soporte_cliente_idx on public.ticket_soporte (id_cliente, creado desc);
create index ticket_soporte_estado_idx  on public.ticket_soporte (estado, creado desc);
create index ticket_soporte_pedido_idx  on public.ticket_soporte (id_pedido) where id_pedido is not null;

create table public.ticket_mensaje (
  id_mensaje  uuid primary key default gen_random_uuid(),
  id_ticket   uuid not null references public.ticket_soporte (id_ticket) on delete cascade,
  autor       text not null,
  mensaje     text not null,
  creado      timestamptz not null default now(),
  creado_por  uuid default auth.uid(),
  constraint ticket_mensaje_autor_chk check (autor in ('Cliente', 'Personal')),
  constraint ticket_mensaje_texto_chk check (length(btrim(mensaje)) between 1 and 2000)
);

create index ticket_mensaje_ticket_idx on public.ticket_mensaje (id_ticket, creado);

create or replace function public.set_editado_ticket_soporte()
returns trigger
language plpgsql
as $function$
begin
  new.editado := now();
  return new;
end $function$;

create trigger trg_set_editado_ticket_soporte
  before update on public.ticket_soporte
  for each row execute function public.set_editado_ticket_soporte();

alter table public.ticket_soporte enable row level security;
alter table public.ticket_mensaje enable row level security;

create policy ticket_soporte_select_personal on public.ticket_soporte
  for select to authenticated using (public.es_personal_erp());
create policy ticket_soporte_insert_personal on public.ticket_soporte
  for insert to authenticated with check (public.es_personal_erp());
create policy ticket_soporte_update_personal on public.ticket_soporte
  for update to authenticated using (public.es_personal_erp()) with check (public.es_personal_erp());

create policy ticket_mensaje_select_personal on public.ticket_mensaje
  for select to authenticated using (public.es_personal_erp());
create policy ticket_mensaje_insert_personal on public.ticket_mensaje
  for insert to authenticated with check (public.es_personal_erp());
