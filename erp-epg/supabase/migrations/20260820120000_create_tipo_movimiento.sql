-- S-04: Gestionar tipos de movimiento de stock
-- Crea el catálogo parametrizable de tipos de movimiento que consumirá S-05.
-- No crea movimiento_stock ni toca el modelo de stock existente (lote / lote_deposito / vistas).

create table if not exists public.tipo_movimiento (
  id_tipo_movimiento uuid primary key default gen_random_uuid(),
  nombre_tipo_movimiento text not null,
  descripcion_tipo_movimiento text not null,
  signo_tipo_movimiento smallint not null,
  activo boolean not null default true,
  creado timestamptz not null default now(),
  editado timestamptz not null default now(),
  creado_por text,
  nombre_tipo_movimiento_normalizado text
    generated always as (lower(btrim(nombre_tipo_movimiento))) stored,
  constraint tipo_movimiento_nombre_not_blank
    check (length(trim(nombre_tipo_movimiento)) > 0),
  constraint tipo_movimiento_descripcion_not_blank
    check (length(trim(descripcion_tipo_movimiento)) > 0),
  constraint tipo_movimiento_signo_valido
    check (signo_tipo_movimiento in (-1, 1)),
  constraint tipo_movimiento_nombre_unique
    unique (nombre_tipo_movimiento_normalizado)
);

comment on column public.tipo_movimiento.nombre_tipo_movimiento_normalizado is
  'Columna generada (lower + trim de nombre_tipo_movimiento) usada solo para la unicidad case-insensitive. No se lee ni se escribe desde la aplicación.';

comment on table public.tipo_movimiento is
  'Catálogo de tipos de movimiento de stock (S-04). Signo: 1 = entrada, -1 = salida. Consumida por S-05, que aún no existe.';

-- Trigger de auditoría: actualiza "editado" y evita pisar "creado" / "creado_por" en un UPDATE.
create or replace function public.set_editado_tipo_movimiento()
returns trigger
language plpgsql
as $$
begin
  set search_path = public;

  new.editado := now();
  new.creado := old.creado;
  new.creado_por := old.creado_por;

  return new;
end;
$$;

drop trigger if exists trg_set_editado_tipo_movimiento on public.tipo_movimiento;

create trigger trg_set_editado_tipo_movimiento
  before update on public.tipo_movimiento
  for each row
  execute function public.set_editado_tipo_movimiento();

-- RLS: habilitada, con las 4 políticas abiertas para "authenticated" vigentes en el resto del proyecto.
-- El control de acceso por rol_usuario todavía no está implementado a nivel RLS (lo desarrolla otro integrante).
alter table public.tipo_movimiento enable row level security;

drop policy if exists tipo_movimiento_select on public.tipo_movimiento;
create policy tipo_movimiento_select
  on public.tipo_movimiento
  for select
  to authenticated
  using (true);

drop policy if exists tipo_movimiento_insert on public.tipo_movimiento;
create policy tipo_movimiento_insert
  on public.tipo_movimiento
  for insert
  to authenticated
  with check (true);

drop policy if exists tipo_movimiento_update on public.tipo_movimiento;
create policy tipo_movimiento_update
  on public.tipo_movimiento
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists tipo_movimiento_delete on public.tipo_movimiento;
create policy tipo_movimiento_delete
  on public.tipo_movimiento
  for delete
  to authenticated
  using (true);
