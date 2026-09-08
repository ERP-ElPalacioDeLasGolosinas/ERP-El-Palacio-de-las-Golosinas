-- =====================================================================
-- T-01 | Cuentas de tesoreria (P1)
-- Sprint 2 - ERP El Palacio de las Golosinas
--
-- Estado: aplicada en Supabase el 2026-09-07.
--
-- ABMC de cuentas de tesoreria (Banco / Caja / Valores). Cada cuenta
-- tiene saldo inicial y saldo actual mantenido, baja logica e historial
-- de movimientos. Los "sub-modulos" Bancos / Cajas / Valores se resuelven
-- como filtro por `tipo`, no como entidades separadas.
--
-- - RLS propia para authenticated (D-010), patron <tabla>_<cmd>_authenticated
--   (NO SECURITY DEFINER / D-005), igual que medio_pago y tipo_comprobante.
-- - saldo_actual arranca igual a saldo_inicial (lo setea fn_cuenta_tesoreria_crear).
-- - fn_cuenta_tesoreria_movimientos_listar lee movimiento_tesoreria, tabla
--   que se crea en T-08; hasta entonces devuelve vacio (se resuelve por
--   SQL dinamico para no depender de una tabla inexistente).
--
-- Codigos de error (CTA*):
--   CTA01 nombre vacio            CTA02 nombre duplicado
--   CTA03 cuenta inexistente (reload)
--   CTA04 / CTA05 reservados para T-07 / T-08 (cuenta con movimientos,
--         cuenta inactiva usada en orden / pago).
-- =====================================================================


-- ---------------------------------------------------------------------
-- Enum de tipo de cuenta
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'tipo_cuenta_tesoreria') then
    create type public.tipo_cuenta_tesoreria as enum ('Banco', 'Caja', 'Valores');
  end if;
end $$;


-- ---------------------------------------------------------------------
-- Tabla
-- ---------------------------------------------------------------------
create table if not exists public.cuenta_tesoreria (
  id_cuenta     uuid primary key default gen_random_uuid(),

  nombre_cuenta text not null,
  tipo          public.tipo_cuenta_tesoreria not null,
  descripcion   text,

  saldo_inicial numeric(16,2) not null default 0,
  saldo_actual  numeric(16,2) not null default 0,

  activo        boolean not null default true,

  creado     timestamptz not null default now(),
  editado    timestamptz not null default now(),
  creado_por uuid not null default auth.uid(),

  constraint cuenta_tesoreria_nombre_check
    check (length(btrim(nombre_cuenta)) > 0)
);

comment on table public.cuenta_tesoreria is
  'T-01 | Cuenta de tesoreria (Banco / Caja / Valores). saldo_actual lo mantiene el circuito de pagos (T-08). Baja logica via activo.';

-- Sin cuentas duplicadas por nombre (case-insensitive, ignorando espacios)
create unique index if not exists cuenta_tesoreria_nombre_uidx
  on public.cuenta_tesoreria (lower(btrim(nombre_cuenta)));

create index if not exists idx_cuenta_tesoreria_tipo
  on public.cuenta_tesoreria (tipo);


-- ---------------------------------------------------------------------
-- Trigger de auditoria
-- ---------------------------------------------------------------------
create or replace function public.set_editado_cuenta_tesoreria()
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

drop trigger if exists trg_set_editado_cuenta_tesoreria on public.cuenta_tesoreria;
create trigger trg_set_editado_cuenta_tesoreria
  before update on public.cuenta_tesoreria
  for each row execute function public.set_editado_cuenta_tesoreria();


-- ---------------------------------------------------------------------
-- Row Level Security - 4 politicas authenticated (D-010)
-- ---------------------------------------------------------------------
alter table public.cuenta_tesoreria enable row level security;

drop policy if exists "cuenta_tesoreria_select_authenticated" on public.cuenta_tesoreria;
drop policy if exists "cuenta_tesoreria_insert_authenticated" on public.cuenta_tesoreria;
drop policy if exists "cuenta_tesoreria_update_authenticated" on public.cuenta_tesoreria;
drop policy if exists "cuenta_tesoreria_delete_authenticated" on public.cuenta_tesoreria;

create policy "cuenta_tesoreria_select_authenticated"
  on public.cuenta_tesoreria for select to authenticated using (true);
create policy "cuenta_tesoreria_insert_authenticated"
  on public.cuenta_tesoreria for insert to authenticated with check (true);
create policy "cuenta_tesoreria_update_authenticated"
  on public.cuenta_tesoreria for update to authenticated using (true) with check (true);
create policy "cuenta_tesoreria_delete_authenticated"
  on public.cuenta_tesoreria for delete to authenticated using (true);


-- ---------------------------------------------------------------------
-- fn_cuenta_tesoreria_listar - listado enriquecido (D-006)
-- ---------------------------------------------------------------------
create or replace function public.fn_cuenta_tesoreria_listar(
  p_incluir_inactivas boolean default true,
  p_tipo public.tipo_cuenta_tesoreria default null
)
returns table (
  id_cuenta uuid,
  nombre_cuenta text,
  tipo public.tipo_cuenta_tesoreria,
  descripcion text,
  saldo_inicial numeric,
  saldo_actual numeric,
  activo boolean,
  creado timestamptz,
  editado timestamptz,
  creado_por uuid,
  creado_por_nombre text
)
language sql
stable
set search_path to 'public'
as $function$
  select
    ct.id_cuenta,
    ct.nombre_cuenta,
    ct.tipo,
    ct.descripcion,
    ct.saldo_inicial,
    ct.saldo_actual,
    ct.activo,
    ct.creado,
    ct.editado,
    ct.creado_por,
    coalesce(ur.nombre_completo, 'Usuario no disponible') as creado_por_nombre
  from public.cuenta_tesoreria ct
  left join public.vw_usuario_resumen ur on ur.id_usuario = ct.creado_por
  where (p_incluir_inactivas or ct.activo = true)
    and (p_tipo is null or ct.tipo = p_tipo)
  order by ct.nombre_cuenta;
$function$;


-- ---------------------------------------------------------------------
-- fn_cuenta_tesoreria_crear
-- ---------------------------------------------------------------------
create or replace function public.fn_cuenta_tesoreria_crear(
  p_nombre text,
  p_tipo public.tipo_cuenta_tesoreria,
  p_descripcion text,
  p_saldo_inicial numeric,
  p_creado_por uuid
)
returns public.cuenta_tesoreria
language plpgsql
set search_path to 'public'
as $function$
declare
  v_nombre text := btrim(p_nombre);
  v_saldo  numeric(16,2) := coalesce(p_saldo_inicial, 0);
  v_cuenta public.cuenta_tesoreria;
begin
  if v_nombre is null or length(v_nombre) = 0 then
    raise exception 'El nombre de la cuenta no puede estar vacio' using errcode = 'CTA01';
  end if;

  if exists (
    select 1 from public.cuenta_tesoreria
    where lower(btrim(nombre_cuenta)) = lower(v_nombre)
  ) then
    raise exception 'Ya existe una cuenta de tesoreria con el nombre "%"', v_nombre
      using errcode = 'CTA02';
  end if;

  begin
    insert into public.cuenta_tesoreria (
      nombre_cuenta, tipo, descripcion, saldo_inicial, saldo_actual, creado_por
    ) values (
      v_nombre, p_tipo, nullif(btrim(p_descripcion), ''), v_saldo, v_saldo,
      coalesce(p_creado_por, auth.uid())
    )
    returning * into v_cuenta;
  exception
    when unique_violation then
      raise exception 'Ya existe una cuenta de tesoreria con el nombre "%"', v_nombre
        using errcode = 'CTA02';
  end;

  return v_cuenta;
end;
$function$;


-- ---------------------------------------------------------------------
-- fn_cuenta_tesoreria_modificar
--   No toca saldo_inicial ni saldo_actual: el saldo lo mantiene el
--   circuito de pagos (T-08).
-- ---------------------------------------------------------------------
create or replace function public.fn_cuenta_tesoreria_modificar(
  p_id_cuenta uuid,
  p_nombre text,
  p_tipo public.tipo_cuenta_tesoreria,
  p_descripcion text
)
returns public.cuenta_tesoreria
language plpgsql
set search_path to 'public'
as $function$
declare
  v_nombre text := btrim(p_nombre);
  v_cuenta public.cuenta_tesoreria;
begin
  if v_nombre is null or length(v_nombre) = 0 then
    raise exception 'El nombre de la cuenta no puede estar vacio' using errcode = 'CTA01';
  end if;

  if not exists (select 1 from public.cuenta_tesoreria where id_cuenta = p_id_cuenta) then
    raise exception 'No se encontro la cuenta de tesoreria indicada' using errcode = 'CTA03';
  end if;

  if exists (
    select 1 from public.cuenta_tesoreria
    where lower(btrim(nombre_cuenta)) = lower(v_nombre)
      and id_cuenta <> p_id_cuenta
  ) then
    raise exception 'Ya existe otra cuenta de tesoreria con el nombre "%"', v_nombre
      using errcode = 'CTA02';
  end if;

  begin
    update public.cuenta_tesoreria
    set nombre_cuenta = v_nombre,
        tipo          = p_tipo,
        descripcion   = nullif(btrim(p_descripcion), '')
    where id_cuenta = p_id_cuenta
    returning * into v_cuenta;
  exception
    when unique_violation then
      raise exception 'Ya existe otra cuenta de tesoreria con el nombre "%"', v_nombre
        using errcode = 'CTA02';
  end;

  return v_cuenta;
end;
$function$;


-- ---------------------------------------------------------------------
-- fn_cuenta_tesoreria_habilitar / _inhabilitar - baja logica (D-004)
-- ---------------------------------------------------------------------
create or replace function public.fn_cuenta_tesoreria_habilitar(p_id_cuenta uuid)
returns public.cuenta_tesoreria
language plpgsql
set search_path to 'public'
as $function$
declare
  v_cuenta public.cuenta_tesoreria;
begin
  if not exists (select 1 from public.cuenta_tesoreria where id_cuenta = p_id_cuenta) then
    raise exception 'No se encontro la cuenta de tesoreria indicada' using errcode = 'CTA03';
  end if;

  update public.cuenta_tesoreria
  set activo = true
  where id_cuenta = p_id_cuenta
  returning * into v_cuenta;

  return v_cuenta;
end;
$function$;

create or replace function public.fn_cuenta_tesoreria_inhabilitar(p_id_cuenta uuid)
returns public.cuenta_tesoreria
language plpgsql
set search_path to 'public'
as $function$
declare
  v_cuenta public.cuenta_tesoreria;
begin
  if not exists (select 1 from public.cuenta_tesoreria where id_cuenta = p_id_cuenta) then
    raise exception 'No se encontro la cuenta de tesoreria indicada' using errcode = 'CTA03';
  end if;

  update public.cuenta_tesoreria
  set activo = false
  where id_cuenta = p_id_cuenta
  returning * into v_cuenta;

  return v_cuenta;
end;
$function$;


-- ---------------------------------------------------------------------
-- fn_cuenta_tesoreria_movimientos_listar
--   Historial desde movimiento_tesoreria (tabla creada en T-08).
--   Hasta entonces devuelve vacio; SQL dinamico para no romper si la
--   tabla aun no existe.
-- ---------------------------------------------------------------------
create or replace function public.fn_cuenta_tesoreria_movimientos_listar(
  p_id_cuenta uuid,
  p_desde date default null,
  p_hasta date default null
)
returns table (
  id_movimiento uuid,
  fecha date,
  tipo text,
  importe numeric,
  saldo_anterior numeric,
  saldo_nuevo numeric,
  referencia text,
  descripcion text,
  creado timestamptz
)
language plpgsql
stable
set search_path to 'public'
as $function$
begin
  if to_regclass('public.movimiento_tesoreria') is null then
    return;
  end if;

  return query execute
    'select m.id_movimiento, m.fecha, m.tipo::text, m.importe,
            m.saldo_anterior, m.saldo_nuevo, m.referencia, m.descripcion, m.creado
     from public.movimiento_tesoreria m
     where m.id_cuenta_tesoreria = $1
       and ($2::date is null or m.fecha >= $2::date)
       and ($3::date is null or m.fecha <= $3::date)
     order by m.fecha desc, m.creado desc'
  using p_id_cuenta, p_desde, p_hasta;
end;
$function$;
