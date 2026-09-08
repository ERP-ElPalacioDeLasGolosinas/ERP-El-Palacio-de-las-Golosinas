-- =====================================================================
-- T-02 | Extender medios de pago: tipo + cuentas de tesoreria (M:N) (P1)
-- Sprint 2 - ERP El Palacio de las Golosinas
--
-- Estado: aplicada en Supabase el 2026-09-07 (migracion 20260907210000).
-- Depende de: T-01 (cuenta_tesoreria).
--
-- medio_pago pasa a tener:
--   - tipo tipo_medio_pago (Efectivo / Transferencia / Cheque propio /
--     Cheque de terceros).
--   - cuentas de tesoreria concretas habilitadas (D-014b: enlace directo
--     a cuentas via tabla M:N medio_pago_cuenta, NO "tipo de cuenta").
--
-- Como nada referencia todavia a medio_pago (sin FKs entrantes,
-- verificado 2026-09-07), se BORRAN los 3 medios existentes y se
-- re-siembran los 4 estandar con su tipo. Los enlaces a cuentas quedan
-- vacios hasta que el usuario los cargue desde la UI.
--
-- fn_medio_pago_crear / _modificar reciben p_tipo y p_cuentas uuid[]
-- (reemplazan el set de enlaces de forma transaccional).
-- fn_medio_pago_listar devuelve tipo + cuentas enlazadas (jsonb).
-- fn_medio_pago_cuentas_compatibles(p_id_medio_pago) [NUEVA] -> cuentas
-- activas enlazadas al medio; la consumen los formularios de orden (T-07)
-- y de pago (T-08).
--
-- Codigos de error (MDP*):
--   MDP01 nombre vacio           MDP02 nombre duplicado
--   MDP03 medio inexistente (reload)
--   MDP04 tipo no indicado       MDP05 cuenta inexistente / inactiva en el enlace
--
-- Patron: SECURITY INVOKER, sin SECURITY DEFINER (D-005); RLS propia
-- authenticated para medio_pago_cuenta (D-010). GRANT EXECUTE explicito
-- a authenticated en las fn_* recreadas (se drop+create por cambio de
-- firma, lo que descarta los grants previos).
-- =====================================================================


-- ---------------------------------------------------------------------
-- Enum de tipo de medio de pago
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'tipo_medio_pago') then
    create type public.tipo_medio_pago as enum
      ('Efectivo', 'Transferencia', 'Cheque propio', 'Cheque de terceros');
  end if;
end $$;


-- ---------------------------------------------------------------------
-- medio_pago: columna tipo (nullable de entrada; NOT NULL tras re-seed)
-- ---------------------------------------------------------------------
alter table public.medio_pago
  add column if not exists tipo public.tipo_medio_pago;

comment on column public.medio_pago.tipo is
  'T-02 | Tipo del medio (Efectivo / Transferencia / Cheque propio / Cheque de terceros). Determina el comportamiento en el circuito de pago.';


-- ---------------------------------------------------------------------
-- Tabla M:N medio_pago <-> cuenta_tesoreria (D-014b)
-- ---------------------------------------------------------------------
-- Tabla puente pura: la auditoria vive en medio_pago (padre del set de enlaces).
create table if not exists public.medio_pago_cuenta (
  id uuid primary key default gen_random_uuid(),

  id_medio_pago       uuid not null
    references public.medio_pago (id_medio_pago) on delete cascade,
  id_cuenta_tesoreria uuid not null
    references public.cuenta_tesoreria (id_cuenta),

  constraint medio_pago_cuenta_uq unique (id_medio_pago, id_cuenta_tesoreria)
);

comment on table public.medio_pago_cuenta is
  'T-02 | Cuentas de tesoreria concretas habilitadas para cada medio de pago (D-014b). Enlace directo, no por "tipo de cuenta".';

create index if not exists idx_medio_pago_cuenta_medio
  on public.medio_pago_cuenta (id_medio_pago);
create index if not exists idx_medio_pago_cuenta_cuenta
  on public.medio_pago_cuenta (id_cuenta_tesoreria);


-- ---------------------------------------------------------------------
-- RLS - 4 politicas authenticated (D-010)
-- ---------------------------------------------------------------------
alter table public.medio_pago_cuenta enable row level security;

drop policy if exists "medio_pago_cuenta_select_authenticated" on public.medio_pago_cuenta;
drop policy if exists "medio_pago_cuenta_insert_authenticated" on public.medio_pago_cuenta;
drop policy if exists "medio_pago_cuenta_update_authenticated" on public.medio_pago_cuenta;
drop policy if exists "medio_pago_cuenta_delete_authenticated" on public.medio_pago_cuenta;

create policy "medio_pago_cuenta_select_authenticated"
  on public.medio_pago_cuenta for select to authenticated using (true);
create policy "medio_pago_cuenta_insert_authenticated"
  on public.medio_pago_cuenta for insert to authenticated with check (true);
create policy "medio_pago_cuenta_update_authenticated"
  on public.medio_pago_cuenta for update to authenticated using (true) with check (true);
create policy "medio_pago_cuenta_delete_authenticated"
  on public.medio_pago_cuenta for delete to authenticated using (true);


-- ---------------------------------------------------------------------
-- Re-seed de los 4 medios estandar con su tipo
--   Nada referencia a medio_pago todavia (sin FKs entrantes).
--   creado_por: auth.uid() es null en contexto de migracion -> se cae
--   al usuario mas antiguo (columna NOT NULL).
-- ---------------------------------------------------------------------
delete from public.medio_pago;

insert into public.medio_pago (nombre_medio_pago, tipo, requiere_referencia, creado_por)
select v.nombre, v.tipo::public.tipo_medio_pago, v.rr,
       coalesce(auth.uid(), (select id from auth.users order by created_at limit 1))
from (values
  ('Efectivo',            'Efectivo',            false),
  ('Transferencia',       'Transferencia',       true),
  ('Cheque propio',       'Cheque propio',       true),
  ('Cheque de terceros',  'Cheque de terceros',  true)
) as v(nombre, tipo, rr);

alter table public.medio_pago
  alter column tipo set not null;


-- ---------------------------------------------------------------------
-- fn_medio_pago_listar - agrega tipo + cuentas enlazadas (jsonb)
-- ---------------------------------------------------------------------
drop function if exists public.fn_medio_pago_listar(boolean);

create or replace function public.fn_medio_pago_listar(
  p_incluir_inactivos boolean default true
)
returns table (
  id_medio_pago uuid,
  nombre_medio_pago text,
  tipo public.tipo_medio_pago,
  requiere_referencia boolean,
  activo boolean,
  creado timestamptz,
  editado timestamptz,
  creado_por uuid,
  creado_por_nombre text,
  cuentas jsonb
)
language sql
stable
set search_path to 'public'
as $function$
  select
    mp.id_medio_pago,
    mp.nombre_medio_pago,
    mp.tipo,
    mp.requiere_referencia,
    mp.activo,
    mp.creado,
    mp.editado,
    mp.creado_por,
    coalesce(ur.nombre_completo, 'Usuario no disponible') as creado_por_nombre,
    coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object(
                   'id_cuenta', ct.id_cuenta,
                   'nombre_cuenta', ct.nombre_cuenta,
                   'tipo', ct.tipo,
                   'activo', ct.activo
                 )
                 order by ct.nombre_cuenta
               )
        from public.medio_pago_cuenta mpc
        join public.cuenta_tesoreria ct on ct.id_cuenta = mpc.id_cuenta_tesoreria
        where mpc.id_medio_pago = mp.id_medio_pago
      ),
      '[]'::jsonb
    ) as cuentas
  from public.medio_pago mp
  left join public.vw_usuario_resumen ur on ur.id_usuario = mp.creado_por
  where p_incluir_inactivos or mp.activo = true
  order by mp.nombre_medio_pago;
$function$;

grant execute on function public.fn_medio_pago_listar(boolean) to authenticated;


-- ---------------------------------------------------------------------
-- fn_medio_pago_crear - + p_tipo + p_cuentas uuid[]
-- ---------------------------------------------------------------------
drop function if exists public.fn_medio_pago_crear(text, boolean, uuid);

create or replace function public.fn_medio_pago_crear(
  p_nombre_medio_pago text,
  p_tipo public.tipo_medio_pago,
  p_requiere_referencia boolean,
  p_creado_por uuid,
  p_cuentas uuid[] default null
)
returns public.medio_pago
language plpgsql
set search_path to 'public'
as $function$
declare
  v_nombre     text := btrim(p_nombre_medio_pago);
  v_medio_pago public.medio_pago;
begin
  if v_nombre is null or length(v_nombre) = 0 then
    raise exception 'El nombre del medio de pago no puede estar vacío'
      using errcode = 'MDP01';
  end if;

  if p_tipo is null then
    raise exception 'Debés indicar el tipo del medio de pago'
      using errcode = 'MDP04';
  end if;

  if exists (select 1 from public.medio_pago where lower(nombre_medio_pago) = lower(v_nombre)) then
    raise exception 'Ya existe un medio de pago con el nombre "%"', v_nombre
      using errcode = 'MDP02';
  end if;

  if p_cuentas is not null and exists (
    select 1 from unnest(p_cuentas) as c(id_cuenta)
    where not exists (
      select 1 from public.cuenta_tesoreria ct
      where ct.id_cuenta = c.id_cuenta and ct.activo = true
    )
  ) then
    raise exception 'Alguna de las cuentas indicadas no existe o está inactiva'
      using errcode = 'MDP05';
  end if;

  begin
    insert into public.medio_pago (nombre_medio_pago, tipo, requiere_referencia, creado_por)
    values (v_nombre, p_tipo, coalesce(p_requiere_referencia, false), p_creado_por)
    returning * into v_medio_pago;
  exception
    when unique_violation then
      raise exception 'Ya existe un medio de pago con el nombre "%"', v_nombre
        using errcode = 'MDP02';
  end;

  if p_cuentas is not null then
    insert into public.medio_pago_cuenta (id_medio_pago, id_cuenta_tesoreria)
    select v_medio_pago.id_medio_pago, c.id_cuenta
    from (select distinct unnest(p_cuentas) as id_cuenta) c;
  end if;

  return v_medio_pago;
end;
$function$;

grant execute on function public.fn_medio_pago_crear(text, public.tipo_medio_pago, boolean, uuid, uuid[]) to authenticated;


-- ---------------------------------------------------------------------
-- fn_medio_pago_modificar - + p_tipo + p_cuentas uuid[]
--   p_cuentas = null  -> no toca los enlaces
--   p_cuentas = '{}'  -> deja el medio sin cuentas
-- ---------------------------------------------------------------------
drop function if exists public.fn_medio_pago_modificar(uuid, text, boolean);

create or replace function public.fn_medio_pago_modificar(
  p_id_medio_pago uuid,
  p_nombre_medio_pago text,
  p_tipo public.tipo_medio_pago,
  p_requiere_referencia boolean,
  p_cuentas uuid[] default null
)
returns public.medio_pago
language plpgsql
set search_path to 'public'
as $function$
declare
  v_nombre     text := btrim(p_nombre_medio_pago);
  v_medio_pago public.medio_pago;
begin
  if v_nombre is null or length(v_nombre) = 0 then
    raise exception 'El nombre del medio de pago no puede estar vacío'
      using errcode = 'MDP01';
  end if;

  if p_tipo is null then
    raise exception 'Debés indicar el tipo del medio de pago'
      using errcode = 'MDP04';
  end if;

  if not exists (select 1 from public.medio_pago where id_medio_pago = p_id_medio_pago) then
    raise exception 'No se encontró el medio de pago indicado'
      using errcode = 'MDP03';
  end if;

  if exists (
    select 1 from public.medio_pago
    where lower(nombre_medio_pago) = lower(v_nombre) and id_medio_pago <> p_id_medio_pago
  ) then
    raise exception 'Ya existe otro medio de pago con el nombre "%"', v_nombre
      using errcode = 'MDP02';
  end if;

  if p_cuentas is not null and exists (
    select 1 from unnest(p_cuentas) as c(id_cuenta)
    where not exists (
      select 1 from public.cuenta_tesoreria ct
      where ct.id_cuenta = c.id_cuenta and ct.activo = true
    )
  ) then
    raise exception 'Alguna de las cuentas indicadas no existe o está inactiva'
      using errcode = 'MDP05';
  end if;

  begin
    update public.medio_pago
    set nombre_medio_pago = v_nombre,
        tipo = p_tipo,
        requiere_referencia = coalesce(p_requiere_referencia, requiere_referencia)
    where id_medio_pago = p_id_medio_pago
    returning * into v_medio_pago;
  exception
    when unique_violation then
      raise exception 'Ya existe otro medio de pago con el nombre "%"', v_nombre
        using errcode = 'MDP02';
  end;

  if p_cuentas is not null then
    delete from public.medio_pago_cuenta where id_medio_pago = p_id_medio_pago;
    insert into public.medio_pago_cuenta (id_medio_pago, id_cuenta_tesoreria)
    select p_id_medio_pago, c.id_cuenta
    from (select distinct unnest(p_cuentas) as id_cuenta) c;
  end if;

  return v_medio_pago;
end;
$function$;

grant execute on function public.fn_medio_pago_modificar(uuid, text, public.tipo_medio_pago, boolean, uuid[]) to authenticated;


-- ---------------------------------------------------------------------
-- fn_medio_pago_cuentas_compatibles [NUEVA]
--   Cuentas activas enlazadas al medio. La consumen los formularios de
--   orden de pago (T-07) y de pago (T-08).
-- ---------------------------------------------------------------------
create or replace function public.fn_medio_pago_cuentas_compatibles(
  p_id_medio_pago uuid
)
returns table (
  id_cuenta uuid,
  nombre_cuenta text,
  tipo public.tipo_cuenta_tesoreria,
  saldo_actual numeric,
  activo boolean
)
language sql
stable
set search_path to 'public'
as $function$
  select
    ct.id_cuenta,
    ct.nombre_cuenta,
    ct.tipo,
    ct.saldo_actual,
    ct.activo
  from public.medio_pago_cuenta mpc
  join public.cuenta_tesoreria ct on ct.id_cuenta = mpc.id_cuenta_tesoreria
  where mpc.id_medio_pago = p_id_medio_pago
    and ct.activo = true
  order by ct.nombre_cuenta;
$function$;

comment on function public.fn_medio_pago_cuentas_compatibles(uuid) is
  'T-02 | Cuentas de tesoreria activas enlazadas a un medio de pago (medio_pago_cuenta). Insumo de los formularios de orden de pago (T-07) y de pago (T-08).';

grant execute on function public.fn_medio_pago_cuentas_compatibles(uuid) to authenticated;
