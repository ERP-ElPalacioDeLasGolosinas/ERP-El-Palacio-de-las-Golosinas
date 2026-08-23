-- =====================================================================
-- A-04 | Gestionar categorías
-- Sprint 1 - ERP El Palacio de las Golosinas (Sistemas III)
--
-- Tabla referencial de categorías (segundo nivel del catálogo).
-- Dependencia: A-03 (rubro).
-- Alineada con AGENTS.md / HU A-04:
--   - PK uuid, columnas en español con sufijo, texto no vacío
--   - FK obligatoria a rubro existente
--   - unique case-insensitive de nombre DENTRO del mismo rubro
--   - auditoría creado/editado/creado_por
--   - RLS abierto a authenticated (RBAC por rol pendiente)
--   - Baja física bloqueada si hay artículos asociados (A-05)
-- =====================================================================

create table if not exists public.categoria (
  id_categoria uuid primary key default gen_random_uuid(),

  id_rubro uuid not null
    references public.rubro (id_rubro)
    on delete restrict
    on update cascade,

  nombre_categoria text not null
    check (length(trim(nombre_categoria)) > 0),

  activo boolean not null default true,

  creado  timestamptz not null default now(),
  editado timestamptz not null default now(),

  -- Nullable mientras no hay login obligatorio; default con JWT si hay sesión.
  creado_por text default coalesce(auth.jwt() ->> 'email', 'sistema')
);

comment on table public.categoria is
  'A-04 | Categorías del catálogo (segundo nivel: subclasificación bajo un rubro).';

comment on column public.categoria.id_rubro is
  'FK obligatoria al rubro (A-03). Sin rubro no hay categoría.';

-- Unicidad: mismo nombre no se repite dentro del mismo rubro (case-insensitive).
create unique index if not exists categoria_rubro_nombre_uidx
  on public.categoria (id_rubro, lower(trim(nombre_categoria)));

create index if not exists idx_categoria_rubro
  on public.categoria (id_rubro);

create index if not exists idx_categoria_activo
  on public.categoria (activo);

-- ---------------------------------------------------------------------
-- Trigger de auditoría
-- ---------------------------------------------------------------------
create or replace function public.set_editado_categoria()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.editado    := now();
  new.creado     := old.creado;
  new.creado_por := old.creado_por;
  return new;
end;
$$;

drop trigger if exists trg_set_editado_categoria on public.categoria;
create trigger trg_set_editado_categoria
  before update on public.categoria
  for each row
  execute function public.set_editado_categoria();

-- ---------------------------------------------------------------------
-- Guard de DELETE (HU A-04 / preparación A-05):
--   bloquear si hay productos asociados vía id_categoria
-- ---------------------------------------------------------------------
create or replace function public.categoria_motivo_bloqueo_delete(p_id_categoria uuid)
returns text
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_tiene_articulos boolean := false;
  v_tiene_col_activo boolean;
begin
  if p_id_categoria is null then
    return null;
  end if;

  if to_regclass('public.producto') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'producto'
         and column_name = 'id_categoria'
     )
  then
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'producto'
        and column_name = 'activo'
    ) into v_tiene_col_activo;

    if v_tiene_col_activo then
      execute $q$
        select exists (
          select 1
          from public.producto p
          where p.id_categoria = $1
            and p.activo is true
        )
      $q$
      into v_tiene_articulos
      using p_id_categoria;
    else
      execute $q$
        select exists (
          select 1
          from public.producto p
          where p.id_categoria = $1
        )
      $q$
      into v_tiene_articulos
      using p_id_categoria;
    end if;
  end if;

  if coalesce(v_tiene_articulos, false) then
    return 'No se puede eliminar la categoría porque tiene artículos asociados.';
  end if;

  return null;
end;
$$;

comment on function public.categoria_motivo_bloqueo_delete(uuid) is
  'A-04 | Motivo de bloqueo de DELETE, o null si la baja física está permitida.';

create or replace function public.fn_categoria_bloquear_delete_con_articulos()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_motivo text;
begin
  v_motivo := public.categoria_motivo_bloqueo_delete(old.id_categoria);
  if v_motivo is not null then
    raise exception '%', v_motivo using errcode = 'P0001';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_categoria_bloquear_delete_con_articulos on public.categoria;
create trigger trg_categoria_bloquear_delete_con_articulos
  before delete on public.categoria
  for each row
  execute function public.fn_categoria_bloquear_delete_con_articulos();

grant execute on function public.categoria_motivo_bloqueo_delete(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Row Level Security (4 políticas abiertas a authenticated — AGENTS.md)
-- ---------------------------------------------------------------------
alter table public.categoria enable row level security;

drop policy if exists "categoria_select_authenticated" on public.categoria;
create policy "categoria_select_authenticated"
  on public.categoria for select
  to authenticated using (true);

drop policy if exists "categoria_insert_authenticated" on public.categoria;
create policy "categoria_insert_authenticated"
  on public.categoria for insert
  to authenticated with check (true);

drop policy if exists "categoria_update_authenticated" on public.categoria;
create policy "categoria_update_authenticated"
  on public.categoria for update
  to authenticated using (true) with check (true);

drop policy if exists "categoria_delete_authenticated" on public.categoria;
create policy "categoria_delete_authenticated"
  on public.categoria for delete
  to authenticated using (true);

grant select, insert, update, delete on table public.categoria to authenticated;
