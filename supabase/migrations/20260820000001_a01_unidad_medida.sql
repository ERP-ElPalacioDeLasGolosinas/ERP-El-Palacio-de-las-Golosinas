-- =====================================================================
-- A-01 | Gestionar unidades de medida
-- Sprint 1 - ERP El Palacio de las Golosinas (Sistemas III)
--
-- Estado: aplicada y verificada en Supabase el 2026-08-21.
--
-- Alineada con el esquema REAL de la base (verificado contra
-- information_schema), no solo con lo declarado en CLAUDE.md:
--   - creado_por NULLABLE, igual que el resto de las tablas hoy (se le
--     quito el NOT NULL porque todavia no hay login). Lleva default
--     automatico que toma el mail del usuario cuando hay sesion.
--   - checks inline, para que los nombres de constraint sigan el patron
--     <tabla>_<columna>_check de las tablas existentes.
--   - politicas RLS con el patron <tabla>_<cmd>_authenticated.
--
-- DEUDA TECNICA (ver bloque al final del archivo).
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

  -- Nullable para no bloquear la carga mientras no haya login, igual que
  -- deposito / marca / producto. El default lo completa solo: guarda el
  -- mail del usuario si hay sesion, y 'sistema' si no la hay.
  creado_por text default coalesce(auth.jwt() ->> 'email', 'sistema')
);

comment on table public.unidad_medida is
  'A-01 | Tabla referencial de unidades de medida del catalogo de productos.';


-- ---------------------------------------------------------------------
-- Unicidad case-insensitive
--
-- Se aparta a proposito de lo que hoy tienen marca y deposito, que usan
-- un UNIQUE comun sobre la columna cruda y por lo tanto admiten "Arcor"
-- y "arcor" como dos registros distintos. El criterio de aceptacion de
-- A-01 exige que no se permitan duplicados, y un UNIQUE comun no alcanza
-- para cumplirlo.
--
-- Si el equipo decide alinear marca y deposito, el arreglo es el mismo
-- patron: drop del unique y create unique index sobre lower(trim(...)).
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


-- =====================================================================
-- PRUEBAS DE ACEPTACION (ejecutadas el 2026-08-21, resultado OK)
-- Correr de a una. Las que dicen DEBE FALLAR son exito si tiran el error
-- indicado: significa que la validacion esta actuando.
-- =====================================================================
--
-- 1) Alta valida -> OK
-- insert into public.unidad_medida (nombre_unidad_medida, abreviatura_unidad_medida)
-- values ('Kilogramo', 'kg');
--
-- 2) Duplicado con distinta capitalizacion -> DEBE FALLAR
--    Error esperado: 23505 unique constraint "unidad_medida_nombre_uidx"
-- insert into public.unidad_medida (nombre_unidad_medida, abreviatura_unidad_medida)
-- values ('kilogramo', 'KG');
--
-- 3) Nombre solo con espacios -> DEBE FALLAR
--    Error esperado: 23514 check constraint
--    "unidad_medida_nombre_unidad_medida_check"
-- insert into public.unidad_medida (nombre_unidad_medida, abreviatura_unidad_medida)
-- values ('   ', 'xx');
--
-- 4) Inhabilitar -> 'editado' debe avanzar y 'creado' quedar intacto
-- update public.unidad_medida set activo = false
-- where nombre_unidad_medida = 'Kilogramo';
--
-- select nombre_unidad_medida, activo, creado, editado, creado_por
-- from public.unidad_medida;
--
-- Resultado verificado: creado 16:42:52, editado 16:43:32, creado_por
-- 'sistema' (el SQL Editor corre sin sesion de usuario).


-- =====================================================================
-- DATOS DE PRUEBA (opcional, descomentar en desarrollo)
-- creado_por se completa solo, se puede omitir.
-- =====================================================================
-- insert into public.unidad_medida (nombre_unidad_medida, abreviatura_unidad_medida) values
--   ('Unidad',    'un'),
--   ('Kilogramo', 'kg'),
--   ('Gramo',     'g'),
--   ('Caja',      'cj'),
--   ('Paquete',   'paq'),
--   ('Litro',     'l');


-- =====================================================================
-- DEUDA TECNICA / PENDIENTES A LEVANTAR CON EL EQUIPO
--
-- 1. creado_por quedo nullable en todas las tablas porque todavia no hay
--    login. El DoD del Sprint 1 pide auditoria y U-08 es de prioridad
--    Alta: cuando exista auth, hacer backfill y volver a poner NOT NULL.
--
-- 2. El mismo default de creado_por conviene aplicarlo a las tablas ya
--    existentes, para que se completen solas:
--      alter table public.marca         alter column creado_por set default coalesce(auth.jwt() ->> 'email', 'sistema');
--      alter table public.deposito      alter column creado_por set default coalesce(auth.jwt() ->> 'email', 'sistema');
--      alter table public.producto      alter column creado_por set default coalesce(auth.jwt() ->> 'email', 'sistema');
--      alter table public.lote          alter column creado_por set default coalesce(auth.jwt() ->> 'email', 'sistema');
--      alter table public.lote_deposito alter column creado_por set default coalesce(auth.jwt() ->> 'email', 'sistema');
--
-- 3. marca y deposito usan UNIQUE comun: hoy admiten "Arcor" y "arcor"
--    como registros distintos. Evaluar migrarlos al indice funcional.
--
-- 4. Verificar si el resto de las tablas tiene su trigger de 'editado'.
--    Si no lo tienen, esa columna nunca se actualiza:
--      select event_object_table, trigger_name, action_timing, event_manipulation
--      from information_schema.triggers where trigger_schema = 'public';
-- =====================================================================