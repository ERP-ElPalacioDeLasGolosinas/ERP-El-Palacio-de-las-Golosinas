-- =====================================================================
-- A-04 | Reparación live: agregar id_rubro a categoria
--
-- Estado real (schema Supabase, ago 2026):
--   - public.rubro existe
--   - public.categoria existe SIN id_rubro
--   - public.producto ya tiene id_categoria → categoria
--
-- create table if not exists NO alcanza: la tabla ya está.
-- Esta migración es idempotente y segura si id_rubro ya existe.
-- =====================================================================

-- 1) Columna + FK + backfill (si faltaba)
do $$
declare
  v_id_rubro uuid;
begin
  if to_regclass('public.rubro') is null then
    raise exception 'Falta public.rubro. Corré antes 20260821130000_a03_rubro.sql';
  end if;

  if to_regclass('public.categoria') is null then
    raise exception 'Falta public.categoria. Corré antes 20260823220000_a04_categoria.sql';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'categoria'
      and column_name = 'id_rubro'
  ) then
    -- Rubro semilla solo si la tabla está vacía (para poder poner NOT NULL).
    select id_rubro into v_id_rubro
    from public.rubro
    order by creado asc
    limit 1;

    if v_id_rubro is null then
      insert into public.rubro (nombre_rubro, activo)
      values ('General', true)
      returning id_rubro into v_id_rubro;
    end if;

    alter table public.categoria
      add column id_rubro uuid;

    update public.categoria
    set id_rubro = v_id_rubro
    where id_rubro is null;

    alter table public.categoria
      alter column id_rubro set not null;

    alter table public.categoria
      add constraint categoria_id_rubro_fkey
      foreign key (id_rubro)
      references public.rubro (id_rubro)
      on delete restrict
      on update cascade;
  end if;
end;
$$;

comment on column public.categoria.id_rubro is
  'FK obligatoria al rubro (A-03). Sin rubro no hay categoría.';

-- 2) Unicidad por rubro + índices
create unique index if not exists categoria_rubro_nombre_uidx
  on public.categoria (id_rubro, lower(trim(nombre_categoria)));

create index if not exists idx_categoria_rubro
  on public.categoria (id_rubro);

create index if not exists idx_categoria_activo
  on public.categoria (activo);

-- 3) Trigger de auditoría
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

-- 4) Guard DELETE (cualquier producto con id_categoria)
create or replace function public.categoria_motivo_bloqueo_delete(p_id_categoria uuid)
returns text
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_tiene_articulos boolean := false;
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

  if coalesce(v_tiene_articulos, false) then
    return 'No se puede eliminar la categoría porque tiene artículos asociados.';
  end if;

  return null;
end;
$$;

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

-- 5) RLS
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
