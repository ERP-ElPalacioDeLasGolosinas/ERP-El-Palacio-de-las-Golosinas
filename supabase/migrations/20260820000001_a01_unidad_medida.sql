-- =====================================================================
-- A-01 | Gestionar unidades de medida
-- Sprint 1 - ERP El Palacio de las Golosinas (Sistemas III)
--
-- Alineada con el esquema REAL de la base (verificado en information_schema),
-- no solo con lo declarado en CLAUDE.md:
--   - creado_por NULLABLE, igual que el resto de las tablas hoy (se le
--     quito el NOT NULL porque todavia no hay login). Default automatico
--     con el mail del usuario logueado cuando exista sesion.
--   - checks inline para que los nombres de constraint sigan el patron
--     <tabla>_<columna>_check
--   - politicas RLS con el patron <tabla>_<cmd>_authenticated
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tabla
-- ---------------------------------------------------------------------
create table if not exists public.unidad_medida (
  id_unidad_medida uuid primary key default gen_random_uuid(),

  nombre_unidad_medida text not null
    check (length(trim(nombre_unidad_medida)) > 0),

  abreviatura_unidad_medida text not null
    check (length(trim(abreviatura_unidad_medida)) > 0),

  activo boolean not null default true,

  creado  timestamptz not null default now(),
  editado timestamptz not null default now(),

  -- Nullable para no bloquear la carga mientras no haya login,
  -- igual que deposito / marca / producto hoy.
  -- El default lo completa solo cuando hay sesion activa.
  creado_por text default coalesce(auth.jwt() ->> 'email', 'sistema')
);

comment on table public.unidad_medida is
  'A-01 | Tabla referencial de unidades de medida del catalogo de productos.';

-- ---------------------------------------------------------------------
-- Unicidad case-insensitive
--
-- NOTA: se aparta a proposito de lo que hoy tienen marca y deposito, que
-- usan un UNIQUE comun sobre la columna cruda y por lo tanto admiten
-- "Arcor" y "arcor" como dos registros distintos. El criterio de
-- aceptacion de A-01 exige que no haya duplicados, y un unique comun no
-- alcanza para cumplirlo.
--
-- Si el equipo decide alinear las tablas existentes, el arreglo es el
-- mismo patron: drop del unique y create unique index sobre lower(trim()).
-- ---------------------------------------------------------------------
create unique index if not exists unidad_medida_nombre_uidx
  on public.unidad_medida (lower(trim(nombre_unidad_medida)));

create unique index if not exists unidad_medida_abreviatura_uidx
  on public.unidad_medida (lower(trim(abreviatura_unidad_medida)));

-- Filtro habitual de la pantalla: solo unidades activas
create index if not exists idx_unidad_medida_activo
  on public.unidad_medida (activo);

-- ---------------------------------------------------------------------
-- Trigger de auditoria
-- Actualiza 'editado' e impide que un UPDATE pise 'creado' / 'creado_por'.
--
-- VERIFICAR con el equipo: la consulta a information_schema.triggers no
-- devolvio triggers en las tablas existentes. Si efectivamente no hay,
-- entonces hoy la columna 'editado' nunca se actualiza en ninguna tabla
-- y hay que replicar este patron en el resto.
-- ---------------------------------------------------------------------
create or replace function public.set_editado_unidad_medida()
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

drop trigger if exists trg_set_editado_unidad_medida on public.unidad_medida;
create trigger trg_set_editado_unidad_medida
  before update on public.unidad_medida
  for each row execute function public.set_editado_unidad_medida();

-- ---------------------------------------------------------------------
-- Row Level Security
-- 4 politicas abiertas para authenticated, mismo patron de nombres que
-- las tablas existentes.
--
-- OJO: la politica de DELETE deja habilitada la baja fisica a nivel base.
-- La regla de A-01 (no eliminar unidades con productos asociados) recien
-- queda garantizada cuando 'producto' tenga su FK id_unidad_medida con
-- ON DELETE RESTRICT (oleada 3, A-05). Hasta entonces la pantalla NO debe
-- ofrecer eliminar: solo inhabilitar (activo = false).
-- ---------------------------------------------------------------------
alter table public.unidad_medida enable row level security;

create policy "unidad_medida_select_authenticated"
  on public.unidad_medida for select
  to authenticated using (true);

create policy "unidad_medida_insert_authenticated"
  on public.unidad_medida for insert
  to authenticated with check (true);

create policy "unidad_medida_update_authenticated"
  on public.unidad_medida for update
  to authenticated using (true) with check (true);

create policy "unidad_medida_delete_authenticated"
  on public.unidad_medida for delete
  to authenticated using (true);

-- ---------------------------------------------------------------------
-- Datos de prueba (opcional)
-- creado_por se completa solo; se puede omitir.
-- ---------------------------------------------------------------------
-- insert into public.unidad_medida (nombre_unidad_medida, abreviatura_unidad_medida) values
--   ('Unidad',    'un'),
--   ('Kilogramo', 'kg'),
--   ('Gramo',     'g'),
--   ('Caja',      'cj'),
--   ('Paquete',   'paq'),
--   ('Litro',     'l');