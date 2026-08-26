-- =====================================================================
-- A-05 | Registrar artículo en el catálogo
-- Sprint 1 - ERP El Palacio de las Golosinas (Sistemas III)
--
-- La tabla `producto` ya existía (creada fuera de control de migraciones,
-- verificada contra information_schema el 2026-08-25). Esta migración
-- solo agrega lo que A-05 necesita, sin tocar columnas/constraints ya
-- probadas (id_producto, id_marca, nombre_producto, descripcion_producto,
-- codigo_producto, creado/editado/creado_por, trigger set_editado_producto).
--
-- Precondición: A-01 (unidad_medida), A-03 (rubro) y A-04 (categoria) ya
-- están mergeadas en esta rama.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Estado activo/inactivo (criterio de aceptación: alta en estado activo)
-- ---------------------------------------------------------------------
alter table public.producto
  add column if not exists activo boolean not null default true;

create index if not exists idx_producto_activo
  on public.producto (activo);

-- ---------------------------------------------------------------------
-- 2) FKs de catálogo que faltaban (precondición A-01/A-03/A-04)
--
-- Solo se agrega id_categoria, no id_rubro: el rubro se llega vía
-- categoria.id_rubro (así lo asume ya el guard de DELETE de A-03/A-04).
-- Guardar id_rubro en producto sería redundante y admitiría
-- inconsistencias (rubro y categoria.id_rubro desalineados).
-- ---------------------------------------------------------------------
alter table public.producto
  add column if not exists id_unidad_medida uuid;

alter table public.producto
  add column if not exists id_categoria uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'producto_id_unidad_medida_fkey'
  ) then
    alter table public.producto
      add constraint producto_id_unidad_medida_fkey
      foreign key (id_unidad_medida)
      references public.unidad_medida (id_unidad_medida)
      on delete restrict
      on update cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'producto_id_categoria_fkey'
  ) then
    alter table public.producto
      add constraint producto_id_categoria_fkey
      foreign key (id_categoria)
      references public.categoria (id_categoria)
      on delete restrict
      on update cascade;
  end if;
end;
$$;

-- Ambas son obligatorias según la HU (precondición: deben existir antes
-- de poder registrar el artículo). Se exige NOT NULL recién después de
-- crear la FK para no romper si llegara a haber filas previas sin estos
-- datos: si el ALTER de abajo falla, es señal de datos existentes que
-- hay que resolver a mano antes de continuar (no se fuerza un backfill
-- arbitrario).
alter table public.producto
  alter column id_unidad_medida set not null;

alter table public.producto
  alter column id_categoria set not null;

create index if not exists idx_producto_id_unidad_medida
  on public.producto (id_unidad_medida);

create index if not exists idx_producto_id_categoria
  on public.producto (id_categoria);

-- ---------------------------------------------------------------------
-- 3) Precios: separar costo (obligatorio) de venta (opcionales, A-11)
--
-- La columna existente `precio_producto` pasa a ser el precio de costo.
-- No hay código en el repo que la referencie todavía, así que el rename
-- es seguro.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'producto'
      and column_name = 'precio_producto'
  ) then
    alter table public.producto rename column precio_producto to precio_costo_producto;
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'producto_precio_producto_check'
  ) then
    alter table public.producto
      rename constraint producto_precio_producto_check to producto_precio_costo_producto_check;
  end if;
end;
$$;

alter table public.producto
  add column if not exists precio_venta_mayorista_producto numeric(12, 2)
    check (precio_venta_mayorista_producto is null or precio_venta_mayorista_producto >= 0);

alter table public.producto
  add column if not exists precio_venta_sugerido_producto numeric(12, 2)
    check (precio_venta_sugerido_producto is null or precio_venta_sugerido_producto >= 0);

-- ---------------------------------------------------------------------
-- 4) Unicidad case-insensitive de código de artículo
--
-- Se mantiene el UNIQUE existente (producto_codigo_producto_key) y se
-- suma un índice funcional, mismo patrón usado para `marca` en A-02
-- (marca_nombre_marca_lower_ux): "ABC-1" y "abc-1" no deben coexistir.
-- ---------------------------------------------------------------------
create unique index if not exists producto_codigo_producto_lower_ux
  on public.producto (lower(trim(codigo_producto)));

-- ---------------------------------------------------------------------
-- 5) Row Level Security (4 políticas abiertas a authenticated — AGENTS.md)
--
-- La tabla ya tiene RLS habilitado (un INSERT anónimo de prueba dio
-- 42501), pero sin política para `authenticated` verificable desde acá.
-- Se agregan las 4 políticas estándar; si ya existían, el DROP IF EXISTS
-- previo las deja en el mismo estado.
-- ---------------------------------------------------------------------
alter table public.producto enable row level security;

drop policy if exists "producto_select_authenticated" on public.producto;
create policy "producto_select_authenticated"
  on public.producto for select
  to authenticated using (true);

drop policy if exists "producto_insert_authenticated" on public.producto;
create policy "producto_insert_authenticated"
  on public.producto for insert
  to authenticated with check (true);

drop policy if exists "producto_update_authenticated" on public.producto;
create policy "producto_update_authenticated"
  on public.producto for update
  to authenticated using (true) with check (true);

drop policy if exists "producto_delete_authenticated" on public.producto;
create policy "producto_delete_authenticated"
  on public.producto for delete
  to authenticated using (true);

grant select, insert, update, delete on table public.producto to authenticated;

comment on column public.producto.activo is
  'A-05 | Estado del artículo en el ERP. Alta = true por defecto.';
comment on column public.producto.id_unidad_medida is
  'A-05 | FK obligatoria a unidad_medida (A-01).';
comment on column public.producto.id_categoria is
  'A-05 | FK obligatoria a categoria (A-04). El rubro se llega vía categoria.id_rubro.';
comment on column public.producto.precio_costo_producto is
  'A-05 | Precio de costo, obligatorio en el alta.';
comment on column public.producto.precio_venta_mayorista_producto is
  'A-05 | Precio de venta mayorista, opcional (puede completarse luego vía A-11).';
comment on column public.producto.precio_venta_sugerido_producto is
  'A-05 | Precio de venta sugerido al público, opcional (puede completarse luego vía A-11).';
