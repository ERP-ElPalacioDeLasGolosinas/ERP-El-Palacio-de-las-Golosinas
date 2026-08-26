-- =====================================================================
-- A-03 | Gestionar rubros
-- Sprint 1 - ERP El Palacio de las Golosinas (Sistemas III)
--
-- Tabla referencial de rubros (primer nivel del catálogo).
-- Alineada con AGENTS.md / DDS / DER:
--   - PK uuid, columnas en español con sufijo, texto no vacío
--   - auditoría creado/editado/creado_por (creado_por nullable)
--   - unique case-insensitive de nombre (mismo criterio que A-01)
--   - RLS abierto a authenticated (RBAC por rol pendiente)
--   - Baja física bloqueada si hay categorías (A-04) o artículos activos
--     asociados vía categoria→producto (A-05). Hoy esas tablas/FKs no
--     existen → DELETE permitido (criterio de aceptación sin asociados).
-- =====================================================================

create table if not exists public.rubro (
  id_rubro uuid primary key default gen_random_uuid(),

  nombre_rubro text not null
    check (length(trim(nombre_rubro)) > 0),

  activo boolean not null default true,

  creado  timestamptz not null default now(),
  editado timestamptz not null default now(),

  -- Nullable mientras no hay login obligatorio; default con JWT si hay sesión.
  creado_por text default coalesce(auth.jwt() ->> 'email', 'sistema')
);

comment on table public.rubro is
  'A-03 | Rubros del catálogo (primer nivel de clasificación: Golosinas, Snacks, Bebidas, …).';

create unique index if not exists rubro_nombre_uidx
  on public.rubro (lower(trim(nombre_rubro)));

create index if not exists idx_rubro_activo
  on public.rubro (activo);

-- ---------------------------------------------------------------------
-- Trigger de auditoría
-- ---------------------------------------------------------------------
create or replace function public.set_editado_rubro()
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

drop trigger if exists trg_set_editado_rubro on public.rubro;
create trigger trg_set_editado_rubro
  before update on public.rubro
  for each row
  execute function public.set_editado_rubro();

-- ---------------------------------------------------------------------
-- Guard de DELETE (DER + HU A-03):
--   1) artículos activos vía categoria→producto → bloquear
--   2) categorías hijas (aunque no haya productos) → bloquear
-- ---------------------------------------------------------------------
create or replace function public.rubro_motivo_bloqueo_delete(p_id_rubro uuid)
returns text
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_tiene_articulos boolean := false;
  v_tiene_categorias boolean := false;
  v_tiene_col_activo boolean;
begin
  if p_id_rubro is null then
    return null;
  end if;

  -- Categorías asociadas (A-04).
  if to_regclass('public.categoria') is not null then
    execute $q$
      select exists (
        select 1 from public.categoria c where c.id_rubro = $1
      )
    $q$
    into v_tiene_categorias
    using p_id_rubro;
  end if;

  -- Artículos activos vía categoria → producto (A-05).
  if to_regclass('public.categoria') is not null
     and to_regclass('public.producto') is not null
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
          join public.categoria c on c.id_categoria = p.id_categoria
          where c.id_rubro = $1
            and p.activo is true
        )
      $q$
      into v_tiene_articulos
      using p_id_rubro;
    else
      execute $q$
        select exists (
          select 1
          from public.producto p
          join public.categoria c on c.id_categoria = p.id_categoria
          where c.id_rubro = $1
        )
      $q$
      into v_tiene_articulos
      using p_id_rubro;
    end if;
  end if;

  if coalesce(v_tiene_articulos, false) then
    return 'No se puede eliminar el rubro porque tiene artículos activos asociados.';
  end if;

  if coalesce(v_tiene_categorias, false) then
    return 'No se puede eliminar el rubro porque tiene categorías asociadas.';
  end if;

  return null;
end;
$$;

comment on function public.rubro_motivo_bloqueo_delete(uuid) is
  'A-03 | Motivo de bloqueo de DELETE, o null si la baja física está permitida.';

-- Compatibilidad con server actions / RPC previa.
create or replace function public.rubro_tiene_articulos_activos(p_id_rubro uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select public.rubro_motivo_bloqueo_delete(p_id_rubro)
    = 'No se puede eliminar el rubro porque tiene artículos activos asociados.';
$$;

create or replace function public.fn_rubro_bloquear_delete_con_articulos()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_motivo text;
begin
  v_motivo := public.rubro_motivo_bloqueo_delete(old.id_rubro);
  if v_motivo is not null then
    raise exception '%', v_motivo using errcode = 'P0001';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_rubro_bloquear_delete_con_articulos on public.rubro;
create trigger trg_rubro_bloquear_delete_con_articulos
  before delete on public.rubro
  for each row
  execute function public.fn_rubro_bloquear_delete_con_articulos();

grant execute on function public.rubro_motivo_bloqueo_delete(uuid) to authenticated;
grant execute on function public.rubro_tiene_articulos_activos(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Row Level Security (4 políticas abiertas a authenticated — AGENTS.md)
-- ---------------------------------------------------------------------
alter table public.rubro enable row level security;

drop policy if exists "rubro_select_authenticated" on public.rubro;
create policy "rubro_select_authenticated"
  on public.rubro for select
  to authenticated using (true);

drop policy if exists "rubro_insert_authenticated" on public.rubro;
create policy "rubro_insert_authenticated"
  on public.rubro for insert
  to authenticated with check (true);

drop policy if exists "rubro_update_authenticated" on public.rubro;
create policy "rubro_update_authenticated"
  on public.rubro for update
  to authenticated using (true) with check (true);

drop policy if exists "rubro_delete_authenticated" on public.rubro;
create policy "rubro_delete_authenticated"
  on public.rubro for delete
  to authenticated using (true);

grant select, insert, update, delete on table public.rubro to authenticated;
