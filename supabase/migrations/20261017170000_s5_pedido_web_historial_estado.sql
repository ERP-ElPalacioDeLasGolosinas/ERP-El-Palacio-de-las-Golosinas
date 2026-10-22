-- S5-17h · Historial de estados del pedido web (insumo del timeline de seguimiento, S5-17i).
-- En vez de tocar fn_pedido_web_registrar / _cambiar_estado / _confirmar_pago, un trigger sobre
-- pedido_web registra cada alta y cada cambio de estado: cubre las tres funciones (y cualquier
-- futura) sin duplicar lógica. Las tres pasan por INSERT o UPDATE de pedido_web.estado.
-- Lectura: solo personal del ERP por política; el cliente lo recibe vía fn_pedido_web_mi_obtener
-- (SECURITY DEFINER, S5-17i).

create table public.pedido_web_historial_estado (
  id_historial uuid primary key default gen_random_uuid(),
  id_pedido    uuid not null references public.pedido_web (id_pedido) on delete cascade,
  estado       public.estado_pedido_web not null,
  fecha        timestamptz not null default now(),
  creado_por   uuid default auth.uid()
);

create index pedido_web_historial_estado_pedido_idx
  on public.pedido_web_historial_estado (id_pedido, fecha);

alter table public.pedido_web_historial_estado enable row level security;

create policy pedido_web_historial_estado_select_personal
  on public.pedido_web_historial_estado for select to authenticated
  using (public.es_personal_erp());

create or replace function public.fn_pedido_web_historial_trg()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' or new.estado is distinct from old.estado then
    insert into public.pedido_web_historial_estado (id_pedido, estado, fecha)
    values (new.id_pedido, new.estado, now());
  end if;
  return new;
end;
$function$;

create trigger trg_pedido_web_historial
  after insert or update of estado on public.pedido_web
  for each row execute function public.fn_pedido_web_historial_trg();

-- Backfill de los pedidos existentes. Las fechas intermedias no se conservaban: se usa `creado`
-- para el alta, `fecha_pago` para Pagado y `editado` para el estado actual si es posterior.
insert into public.pedido_web_historial_estado (id_pedido, estado, fecha)
select id_pedido, 'Pendiente de pago', creado from public.pedido_web;

insert into public.pedido_web_historial_estado (id_pedido, estado, fecha)
select id_pedido, 'Pagado', coalesce(fecha_pago, editado)
from public.pedido_web
where estado in ('Pagado', 'En preparación', 'Despachado') and fecha_pago is not null
   or estado = 'Pagado';

insert into public.pedido_web_historial_estado (id_pedido, estado, fecha)
select id_pedido, estado, editado
from public.pedido_web
where estado in ('En preparación', 'Despachado', 'Cancelado');
