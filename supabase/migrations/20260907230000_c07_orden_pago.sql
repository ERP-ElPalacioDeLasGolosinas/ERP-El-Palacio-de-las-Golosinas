-- =====================================================================
-- T-07 | C-07 Ordenes de pago a proveedor (P2)
-- Sprint 2 - ERP El Palacio de las Golosinas
--
-- Depende de: T-C1 (estado del comprobante), T-01 (cuenta_tesoreria),
--             T-02 (medio_pago.tipo + medio_pago_cuenta), S2-2c.
-- Bloquea: T-08 (pagos).
--
-- Una orden de pago instruye cancelar total o parcialmente uno o mas
-- comprobantes DEL MISMO PROVEEDOR, con uno o mas medios de pago y su
-- cuenta de tesoreria. No mueve saldos: eso es T-08. Estados
-- (estado_orden_pago): Borrador / Pendiente de pago / Pagada parcial /
-- Pagada / Cancelada.
--
-- Modelo (D-014):
--   - orden_pago              cabecera; importe_total = suma imputada.
--   - orden_pago_comprobante  imputacion N:M (importe_imputado por comp.).
--   - orden_pago_medio        medios N:1 (cada uno con su cuenta).
--
-- Funciones:
--   - fn_orden_pago_aplicar_detalle   [NUEVA, helper interno]
--       valida imputaciones + medios y reemplaza el detalle de una orden.
--   - fn_orden_pago_crear             [NUEVA] transaccional, p_confirmar.
--   - fn_orden_pago_editar            [NUEVA] solo estado Borrador.
--   - fn_orden_pago_confirmar         [NUEVA] Borrador -> Pendiente de pago.
--   - fn_orden_pago_cancelar          [NUEVA] -> Cancelada (si no tiene pagos).
--   - fn_orden_pago_listar            [NUEVA] listado enriquecido.
--   - fn_orden_pago_obtener           [NUEVA] cabecera + imputaciones + medios (jsonb).
--   - fn_comprobante_ordenes_pago_listar [NUEVA] ordenes de un comprobante.
--   - fn_comprobante_recalcular_estado [MODIFICADA] ahora conoce el estado
--       "En orden de pago" (T-C1 lo dejo reservado para T-07). Sin cambio
--       de firma; deriva "En orden de pago" cuando el comprobante esta
--       imputado en una orden Pendiente de pago / Pagada parcial y todavia
--       tiene saldo.
--
-- Codigos de error (OPG* - SQLSTATE de 5 chars; "OP0x" en el plan):
--   OPG01 proveedor inexistente / inactivo
--   OPG02 comprobante de otro proveedor
--   OPG03 comprobante inexistente / anulado / sin saldo / repetido / lista vacia
--   OPG04 importe imputado <= 0 o mayor al saldo del comprobante
--   OPG05 suma de medios != suma imputada / medio con importe <= 0 / sin medios al confirmar
--   OPG06 cuenta no habilitada para el medio (no esta en medio_pago_cuenta)
--   OPG07 medio o cuenta inexistente / inactivo
--   OPG08 orden inexistente (reload)
--   OPG09 orden no editable / no cancelable por estado
--
-- Patron: SECURITY INVOKER, RLS propia authenticated por tabla (D-010).
-- =====================================================================


-- ---------------------------------------------------------------------
-- Enum de estado de la orden de pago
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'estado_orden_pago') then
    create type public.estado_orden_pago as enum (
      'Borrador',
      'Pendiente de pago',
      'Pagada parcial',
      'Pagada',
      'Cancelada'
    );
  end if;
end $$;


-- ---------------------------------------------------------------------
-- Cabecera
-- ---------------------------------------------------------------------
create table if not exists public.orden_pago (
  id_orden_pago  uuid primary key default gen_random_uuid(),

  id_proveedor   uuid not null references public.proveedor (id_proveedor),

  fecha_prevista date,
  referencia     text,
  observaciones  text,

  estado         public.estado_orden_pago not null default 'Borrador',
  importe_total  numeric(16,2) not null default 0,

  creado     timestamptz not null default now(),
  editado    timestamptz not null default now(),
  creado_por uuid not null default auth.uid()
);

comment on table public.orden_pago is
  'T-07 | Orden de pago a proveedor (D-014). importe_total = suma de importe_imputado. No mueve saldos (eso es T-08).';

create index if not exists idx_orden_pago_proveedor on public.orden_pago (id_proveedor);
create index if not exists idx_orden_pago_estado on public.orden_pago (estado);


-- ---------------------------------------------------------------------
-- Imputacion N:M orden <-> comprobante
-- ---------------------------------------------------------------------
create table if not exists public.orden_pago_comprobante (
  id              uuid primary key default gen_random_uuid(),

  id_orden_pago   uuid not null
    references public.orden_pago (id_orden_pago) on delete cascade,
  id_comprobante  uuid not null
    references public.comprobante_proveedor (id_comprobante),

  importe_imputado numeric(16,2) not null
    check (importe_imputado > 0),

  constraint orden_pago_comprobante_uq unique (id_orden_pago, id_comprobante)
);

comment on table public.orden_pago_comprobante is
  'T-07 | Cuanto de la orden se imputa a cada comprobante del proveedor.';

create index if not exists idx_orden_pago_comprobante_orden
  on public.orden_pago_comprobante (id_orden_pago);
create index if not exists idx_orden_pago_comprobante_comprobante
  on public.orden_pago_comprobante (id_comprobante);


-- ---------------------------------------------------------------------
-- Medios de la orden (varios, cada uno con su cuenta)
-- ---------------------------------------------------------------------
create table if not exists public.orden_pago_medio (
  id                  uuid primary key default gen_random_uuid(),

  id_orden_pago       uuid not null
    references public.orden_pago (id_orden_pago) on delete cascade,
  id_medio_pago       uuid not null references public.medio_pago (id_medio_pago),
  id_cuenta_tesoreria uuid not null references public.cuenta_tesoreria (id_cuenta),

  importe    numeric(16,2) not null check (importe > 0),
  referencia text
);

comment on table public.orden_pago_medio is
  'T-07 | Medios con los que se planea pagar la orden. La cuenta debe estar habilitada para el medio (medio_pago_cuenta).';

create index if not exists idx_orden_pago_medio_orden
  on public.orden_pago_medio (id_orden_pago);


-- ---------------------------------------------------------------------
-- Trigger de auditoria (solo cabecera)
-- ---------------------------------------------------------------------
create or replace function public.set_editado_orden_pago()
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

drop trigger if exists trg_set_editado_orden_pago on public.orden_pago;
create trigger trg_set_editado_orden_pago
  before update on public.orden_pago
  for each row execute function public.set_editado_orden_pago();


-- ---------------------------------------------------------------------
-- Row Level Security - 4 politicas authenticated por tabla (D-010)
-- ---------------------------------------------------------------------
alter table public.orden_pago enable row level security;
alter table public.orden_pago_comprobante enable row level security;
alter table public.orden_pago_medio enable row level security;

drop policy if exists "orden_pago_select_authenticated" on public.orden_pago;
drop policy if exists "orden_pago_insert_authenticated" on public.orden_pago;
drop policy if exists "orden_pago_update_authenticated" on public.orden_pago;
drop policy if exists "orden_pago_delete_authenticated" on public.orden_pago;
create policy "orden_pago_select_authenticated"
  on public.orden_pago for select to authenticated using (true);
create policy "orden_pago_insert_authenticated"
  on public.orden_pago for insert to authenticated with check (true);
create policy "orden_pago_update_authenticated"
  on public.orden_pago for update to authenticated using (true) with check (true);
create policy "orden_pago_delete_authenticated"
  on public.orden_pago for delete to authenticated using (true);

drop policy if exists "orden_pago_comprobante_select_authenticated" on public.orden_pago_comprobante;
drop policy if exists "orden_pago_comprobante_insert_authenticated" on public.orden_pago_comprobante;
drop policy if exists "orden_pago_comprobante_update_authenticated" on public.orden_pago_comprobante;
drop policy if exists "orden_pago_comprobante_delete_authenticated" on public.orden_pago_comprobante;
create policy "orden_pago_comprobante_select_authenticated"
  on public.orden_pago_comprobante for select to authenticated using (true);
create policy "orden_pago_comprobante_insert_authenticated"
  on public.orden_pago_comprobante for insert to authenticated with check (true);
create policy "orden_pago_comprobante_update_authenticated"
  on public.orden_pago_comprobante for update to authenticated using (true) with check (true);
create policy "orden_pago_comprobante_delete_authenticated"
  on public.orden_pago_comprobante for delete to authenticated using (true);

drop policy if exists "orden_pago_medio_select_authenticated" on public.orden_pago_medio;
drop policy if exists "orden_pago_medio_insert_authenticated" on public.orden_pago_medio;
drop policy if exists "orden_pago_medio_update_authenticated" on public.orden_pago_medio;
drop policy if exists "orden_pago_medio_delete_authenticated" on public.orden_pago_medio;
create policy "orden_pago_medio_select_authenticated"
  on public.orden_pago_medio for select to authenticated using (true);
create policy "orden_pago_medio_insert_authenticated"
  on public.orden_pago_medio for insert to authenticated with check (true);
create policy "orden_pago_medio_update_authenticated"
  on public.orden_pago_medio for update to authenticated using (true) with check (true);
create policy "orden_pago_medio_delete_authenticated"
  on public.orden_pago_medio for delete to authenticated using (true);


-- ---------------------------------------------------------------------
-- fn_comprobante_recalcular_estado - MODIFICADA (conoce "En orden de pago")
--
-- Antes (T-C1): derivaba solo Pendiente / Pagado parcial / Pagado desde
-- saldo_pendiente; T-C1 dejo explicito que "En orden de pago" lo administra
-- T-07. Problema: sin este cambio, confirmar o cancelar una orden no se
-- refleja en el estado del comprobante.
-- Ahora: si el comprobante tiene saldo y esta imputado en alguna orden en
-- estado Pendiente de pago / Pagada parcial, su estado es "En orden de
-- pago"; en cualquier otro caso se deriva del saldo como antes. Sigue sin
-- tocar los comprobantes anulados. Misma firma y mismo retorno.
-- Efecto secundario: ahora depende de orden_pago / orden_pago_comprobante
-- (creadas en esta misma migracion).
-- ---------------------------------------------------------------------
create or replace function public.fn_comprobante_recalcular_estado(p_id_comprobante uuid)
returns public.comprobante_proveedor
language plpgsql
set search_path to 'public'
as $function$
declare
  v_comprobante public.comprobante_proveedor;
begin
  select * into v_comprobante
  from public.comprobante_proveedor
  where id_comprobante = p_id_comprobante;

  if v_comprobante.id_comprobante is null then
    raise exception 'El comprobante indicado no existe' using errcode = 'CMP08';
  end if;

  -- Un comprobante anulado no cambia de estado por recalculo.
  if v_comprobante.anulado then
    return v_comprobante;
  end if;

  update public.comprobante_proveedor
  set estado = case
    when saldo_pendiente <= 0 then 'Pagado'
    when exists (
      select 1
      from public.orden_pago_comprobante opc
      join public.orden_pago op on op.id_orden_pago = opc.id_orden_pago
      where opc.id_comprobante = p_id_comprobante
        and op.estado in ('Pendiente de pago', 'Pagada parcial')
    ) then 'En orden de pago'
    when saldo_pendiente < importe_total then 'Pagado parcial'
    else 'Pendiente'
  end::public.estado_comprobante_proveedor
  where id_comprobante = p_id_comprobante
  returning * into v_comprobante;

  return v_comprobante;
end;
$function$;

comment on function public.fn_comprobante_recalcular_estado(uuid) is
  'T-C1 / T-07 | Recalcula el estado del comprobante: Pagado (saldo 0), "En orden de pago" (imputado en orden Pendiente de pago / Pagada parcial y con saldo), Pagado parcial, o Pendiente. No toca los anulados. Punto unico que llaman ordenes de pago y pagos.';


-- ---------------------------------------------------------------------
-- fn_orden_pago_aplicar_detalle - helper interno (NUEVA)
--   Valida imputaciones + medios y reemplaza el detalle de una orden ya
--   creada. p_medios_opcionales = true (borrador): admite sin medios; con
--   medios igual valida que sumen lo imputado. false (confirmar): exige
--   medios que sumen exactamente lo imputado.
--   Deja orden_pago.importe_total = suma imputada.
-- ---------------------------------------------------------------------
create or replace function public.fn_orden_pago_aplicar_detalle(
  p_id_orden_pago uuid,
  p_id_proveedor uuid,
  p_imputaciones jsonb,
  p_medios jsonb,
  p_medios_opcionales boolean
)
returns void
language plpgsql
security invoker
set search_path to 'public'
as $function$
declare
  r                record;
  v_comp           public.comprobante_proveedor;
  v_activo         boolean;
  v_suma_imputada  numeric(16,2);
  v_suma_medios    numeric(16,2);
  v_hay_medios     boolean;
begin
  if p_imputaciones is null
     or jsonb_typeof(p_imputaciones) <> 'array'
     or jsonb_array_length(p_imputaciones) = 0 then
    raise exception 'La orden debe imputar al menos un comprobante' using errcode = 'OPG03';
  end if;

  if (
    select count(distinct (e.value->>'id_comprobante'))
    from jsonb_array_elements(p_imputaciones) as e(value)
  ) <> jsonb_array_length(p_imputaciones) then
    raise exception 'Hay comprobantes repetidos en la orden' using errcode = 'OPG03';
  end if;

  for r in
    select (e.value->>'id_comprobante')::uuid as id_comprobante,
           (e.value->>'importe_imputado')::numeric as importe_imputado
    from jsonb_array_elements(p_imputaciones) as e(value)
  loop
    select * into v_comp
    from public.comprobante_proveedor
    where id_comprobante = r.id_comprobante;

    if v_comp.id_comprobante is null then
      raise exception 'Uno de los comprobantes de la orden no existe' using errcode = 'OPG03';
    end if;
    if v_comp.id_proveedor <> p_id_proveedor then
      raise exception 'Todos los comprobantes de la orden deben ser del mismo proveedor' using errcode = 'OPG02';
    end if;
    if v_comp.anulado or v_comp.saldo_pendiente <= 0 or v_comp.estado = 'Pagado' then
      raise exception 'Uno de los comprobantes esta anulado o no tiene saldo pendiente' using errcode = 'OPG03';
    end if;
    if r.importe_imputado is null or r.importe_imputado <= 0 then
      raise exception 'El importe imputado a cada comprobante debe ser mayor a cero' using errcode = 'OPG04';
    end if;
    if round(r.importe_imputado, 2) > round(v_comp.saldo_pendiente, 2) then
      raise exception 'No se puede imputar % a un comprobante con saldo %',
        to_char(round(r.importe_imputado, 2), 'FM999999999990.00'),
        to_char(round(v_comp.saldo_pendiente, 2), 'FM999999999990.00')
        using errcode = 'OPG04';
    end if;
  end loop;

  select coalesce(sum((e.value->>'importe_imputado')::numeric), 0)
    into v_suma_imputada
  from jsonb_array_elements(p_imputaciones) as e(value);

  v_hay_medios := p_medios is not null
    and jsonb_typeof(p_medios) = 'array'
    and jsonb_array_length(p_medios) > 0;

  if not v_hay_medios and not p_medios_opcionales then
    raise exception 'Indica al menos un medio de pago para confirmar la orden' using errcode = 'OPG05';
  end if;

  if v_hay_medios then
    for r in
      select (e.value->>'id_medio_pago')::uuid as id_medio_pago,
             (e.value->>'id_cuenta_tesoreria')::uuid as id_cuenta_tesoreria,
             (e.value->>'importe')::numeric as importe
      from jsonb_array_elements(p_medios) as e(value)
    loop
      if r.importe is null or r.importe <= 0 then
        raise exception 'El importe de cada medio de pago debe ser mayor a cero' using errcode = 'OPG05';
      end if;

      select activo into v_activo from public.medio_pago where id_medio_pago = r.id_medio_pago;
      if v_activo is null then
        raise exception 'Uno de los medios de pago no existe' using errcode = 'OPG07';
      end if;
      if v_activo = false then
        raise exception 'Uno de los medios de pago esta inactivo' using errcode = 'OPG07';
      end if;

      select activo into v_activo from public.cuenta_tesoreria where id_cuenta = r.id_cuenta_tesoreria;
      if v_activo is null then
        raise exception 'Una de las cuentas de tesoreria no existe' using errcode = 'OPG07';
      end if;
      if v_activo = false then
        raise exception 'Una de las cuentas de tesoreria esta inactiva' using errcode = 'OPG07';
      end if;

      if not exists (
        select 1 from public.medio_pago_cuenta
        where id_medio_pago = r.id_medio_pago
          and id_cuenta_tesoreria = r.id_cuenta_tesoreria
      ) then
        raise exception 'La cuenta elegida no esta habilitada para ese medio de pago' using errcode = 'OPG06';
      end if;
    end loop;

    select coalesce(sum((e.value->>'importe')::numeric), 0)
      into v_suma_medios
    from jsonb_array_elements(p_medios) as e(value);

    if round(v_suma_medios, 2) <> round(v_suma_imputada, 2) then
      raise exception 'La suma de los medios (%) no coincide con lo imputado (%)',
        to_char(round(v_suma_medios, 2), 'FM999999999990.00'),
        to_char(round(v_suma_imputada, 2), 'FM999999999990.00')
        using errcode = 'OPG05';
    end if;
  end if;

  delete from public.orden_pago_comprobante where id_orden_pago = p_id_orden_pago;
  delete from public.orden_pago_medio where id_orden_pago = p_id_orden_pago;

  insert into public.orden_pago_comprobante (id_orden_pago, id_comprobante, importe_imputado)
  select p_id_orden_pago,
         (e.value->>'id_comprobante')::uuid,
         round((e.value->>'importe_imputado')::numeric, 2)
  from jsonb_array_elements(p_imputaciones) as e(value);

  if v_hay_medios then
    insert into public.orden_pago_medio (
      id_orden_pago, id_medio_pago, id_cuenta_tesoreria, importe, referencia
    )
    select p_id_orden_pago,
           (e.value->>'id_medio_pago')::uuid,
           (e.value->>'id_cuenta_tesoreria')::uuid,
           round((e.value->>'importe')::numeric, 2),
           nullif(btrim(e.value->>'referencia'), '')
    from jsonb_array_elements(p_medios) as e(value);
  end if;

  update public.orden_pago
  set importe_total = round(v_suma_imputada, 2)
  where id_orden_pago = p_id_orden_pago;
end;
$function$;


-- ---------------------------------------------------------------------
-- fn_orden_pago_crear - alta transaccional (NUEVA)
--   p_confirmar = false -> queda en Borrador (medios opcionales).
--   p_confirmar = true  -> pasa a Pendiente de pago; exige medios que
--                          sumen lo imputado; los comprobantes quedan
--                          "En orden de pago".
-- ---------------------------------------------------------------------
create or replace function public.fn_orden_pago_crear(
  p_id_proveedor uuid,
  p_fecha_prevista date,
  p_referencia text,
  p_observaciones text,
  p_imputaciones jsonb,
  p_medios jsonb,
  p_confirmar boolean,
  p_creado_por uuid
)
returns public.orden_pago
language plpgsql
set search_path to 'public'
as $function$
declare
  v_orden         public.orden_pago;
  v_prov_activo   boolean;
  v_confirmar     boolean := coalesce(p_confirmar, false);
  r               record;
begin
  select activo into v_prov_activo
  from public.proveedor where id_proveedor = p_id_proveedor;
  if v_prov_activo is null then
    raise exception 'El proveedor indicado no existe' using errcode = 'OPG01';
  end if;
  if v_prov_activo = false then
    raise exception 'El proveedor esta inactivo y no admite ordenes de pago' using errcode = 'OPG01';
  end if;

  insert into public.orden_pago (
    id_proveedor, fecha_prevista, referencia, observaciones, estado, creado_por
  ) values (
    p_id_proveedor, p_fecha_prevista,
    nullif(btrim(p_referencia), ''), nullif(btrim(p_observaciones), ''),
    'Borrador', coalesce(p_creado_por, auth.uid())
  )
  returning * into v_orden;

  perform public.fn_orden_pago_aplicar_detalle(
    v_orden.id_orden_pago, p_id_proveedor, p_imputaciones, p_medios, not v_confirmar
  );

  if v_confirmar then
    update public.orden_pago
    set estado = 'Pendiente de pago'
    where id_orden_pago = v_orden.id_orden_pago;

    for r in
      select id_comprobante from public.orden_pago_comprobante
      where id_orden_pago = v_orden.id_orden_pago
    loop
      perform public.fn_comprobante_recalcular_estado(r.id_comprobante);
    end loop;
  end if;

  select * into v_orden from public.orden_pago where id_orden_pago = v_orden.id_orden_pago;
  return v_orden;
end;
$function$;


-- ---------------------------------------------------------------------
-- fn_orden_pago_editar - solo estado Borrador (NUEVA)
-- ---------------------------------------------------------------------
create or replace function public.fn_orden_pago_editar(
  p_id_orden_pago uuid,
  p_fecha_prevista date,
  p_referencia text,
  p_observaciones text,
  p_imputaciones jsonb,
  p_medios jsonb
)
returns public.orden_pago
language plpgsql
set search_path to 'public'
as $function$
declare
  v_orden public.orden_pago;
begin
  select * into v_orden from public.orden_pago where id_orden_pago = p_id_orden_pago;
  if v_orden.id_orden_pago is null then
    raise exception 'La orden de pago indicada no existe' using errcode = 'OPG08';
  end if;
  if v_orden.estado <> 'Borrador' then
    raise exception 'Solo se puede editar una orden en estado Borrador' using errcode = 'OPG09';
  end if;

  update public.orden_pago
  set fecha_prevista = p_fecha_prevista,
      referencia     = nullif(btrim(p_referencia), ''),
      observaciones  = nullif(btrim(p_observaciones), '')
  where id_orden_pago = p_id_orden_pago;

  perform public.fn_orden_pago_aplicar_detalle(
    p_id_orden_pago, v_orden.id_proveedor, p_imputaciones, p_medios, true
  );

  select * into v_orden from public.orden_pago where id_orden_pago = p_id_orden_pago;
  return v_orden;
end;
$function$;


-- ---------------------------------------------------------------------
-- fn_orden_pago_confirmar - Borrador -> Pendiente de pago (NUEVA)
--   Revalida contra el detalle ya guardado (los saldos pueden haber
--   cambiado desde que se creo el borrador).
-- ---------------------------------------------------------------------
create or replace function public.fn_orden_pago_confirmar(p_id_orden_pago uuid)
returns public.orden_pago
language plpgsql
set search_path to 'public'
as $function$
declare
  v_orden          public.orden_pago;
  v_suma_imputada  numeric(16,2);
  v_suma_medios    numeric(16,2);
  v_cant_medios    integer;
  r                record;
  v_comp           public.comprobante_proveedor;
begin
  select * into v_orden from public.orden_pago where id_orden_pago = p_id_orden_pago;
  if v_orden.id_orden_pago is null then
    raise exception 'La orden de pago indicada no existe' using errcode = 'OPG08';
  end if;
  if v_orden.estado <> 'Borrador' then
    raise exception 'Solo se puede confirmar una orden en estado Borrador' using errcode = 'OPG09';
  end if;

  for r in
    select opc.id_comprobante, opc.importe_imputado
    from public.orden_pago_comprobante opc
    where opc.id_orden_pago = p_id_orden_pago
  loop
    select * into v_comp
    from public.comprobante_proveedor where id_comprobante = r.id_comprobante;
    if v_comp.anulado or v_comp.saldo_pendiente <= 0 or v_comp.estado = 'Pagado' then
      raise exception 'Un comprobante de la orden se anulo o quedo sin saldo. Revisa el borrador.' using errcode = 'OPG03';
    end if;
    if round(r.importe_imputado, 2) > round(v_comp.saldo_pendiente, 2) then
      raise exception 'Un importe imputado supera el saldo actual del comprobante. Revisa el borrador.' using errcode = 'OPG04';
    end if;
  end loop;

  select coalesce(sum(importe_imputado), 0) into v_suma_imputada
  from public.orden_pago_comprobante where id_orden_pago = p_id_orden_pago;

  select count(*), coalesce(sum(importe), 0) into v_cant_medios, v_suma_medios
  from public.orden_pago_medio where id_orden_pago = p_id_orden_pago;

  if v_cant_medios = 0 then
    raise exception 'La orden no tiene medios de pago cargados' using errcode = 'OPG05';
  end if;
  if round(v_suma_medios, 2) <> round(v_suma_imputada, 2) then
    raise exception 'La suma de los medios (%) no coincide con lo imputado (%)',
      to_char(round(v_suma_medios, 2), 'FM999999999990.00'),
      to_char(round(v_suma_imputada, 2), 'FM999999999990.00')
      using errcode = 'OPG05';
  end if;

  update public.orden_pago set estado = 'Pendiente de pago'
  where id_orden_pago = p_id_orden_pago
  returning * into v_orden;

  for r in
    select id_comprobante from public.orden_pago_comprobante
    where id_orden_pago = p_id_orden_pago
  loop
    perform public.fn_comprobante_recalcular_estado(r.id_comprobante);
  end loop;

  return v_orden;
end;
$function$;


-- ---------------------------------------------------------------------
-- fn_orden_pago_cancelar - -> Cancelada (NUEVA)
--   No se puede cancelar una orden que ya tiene pagos (tabla pago, T-08).
--   Al cancelar, los comprobantes vuelven a Pendiente / Pagado parcial.
-- ---------------------------------------------------------------------
create or replace function public.fn_orden_pago_cancelar(p_id_orden_pago uuid)
returns public.orden_pago
language plpgsql
set search_path to 'public'
as $function$
declare
  v_orden public.orden_pago;
  r       record;
begin
  select * into v_orden from public.orden_pago where id_orden_pago = p_id_orden_pago;
  if v_orden.id_orden_pago is null then
    raise exception 'La orden de pago indicada no existe' using errcode = 'OPG08';
  end if;
  if v_orden.estado in ('Pagada', 'Cancelada') then
    raise exception 'La orden ya esta % y no puede cancelarse', lower(v_orden.estado::text)
      using errcode = 'OPG09';
  end if;

  if to_regclass('public.pago') is not null then
    if exists (
      select 1 from public.pago where id_orden_pago = p_id_orden_pago
    ) then
      raise exception 'La orden ya tiene pagos registrados y no puede cancelarse' using errcode = 'OPG09';
    end if;
  end if;

  update public.orden_pago set estado = 'Cancelada'
  where id_orden_pago = p_id_orden_pago
  returning * into v_orden;

  for r in
    select id_comprobante from public.orden_pago_comprobante
    where id_orden_pago = p_id_orden_pago
  loop
    perform public.fn_comprobante_recalcular_estado(r.id_comprobante);
  end loop;

  return v_orden;
end;
$function$;


-- ---------------------------------------------------------------------
-- fn_orden_pago_listar - listado enriquecido (NUEVA)
-- ---------------------------------------------------------------------
create or replace function public.fn_orden_pago_listar(
  p_id_proveedor uuid default null,
  p_estado public.estado_orden_pago default null,
  p_desde date default null,
  p_hasta date default null
)
returns table (
  id_orden_pago uuid,
  id_proveedor uuid,
  nombre_proveedor text,
  fecha_prevista date,
  referencia text,
  observaciones text,
  estado public.estado_orden_pago,
  importe_total numeric,
  cantidad_comprobantes bigint,
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
    o.id_orden_pago,
    o.id_proveedor,
    p.nombre_proveedor,
    o.fecha_prevista,
    o.referencia,
    o.observaciones,
    o.estado,
    o.importe_total,
    (select count(*) from public.orden_pago_comprobante opc
      where opc.id_orden_pago = o.id_orden_pago) as cantidad_comprobantes,
    o.creado,
    o.editado,
    o.creado_por,
    coalesce(ur.nombre_completo, 'Usuario no disponible') as creado_por_nombre
  from public.orden_pago o
  join public.proveedor p on p.id_proveedor = o.id_proveedor
  left join public.vw_usuario_resumen ur on ur.id_usuario = o.creado_por
  where (p_id_proveedor is null or o.id_proveedor = p_id_proveedor)
    and (p_estado is null or o.estado = p_estado)
    and (p_desde is null or o.creado::date >= p_desde)
    and (p_hasta is null or o.creado::date <= p_hasta)
  order by o.creado desc;
$function$;

comment on function public.fn_orden_pago_listar(uuid, public.estado_orden_pago, date, date) is
  'T-07 | Listado de ordenes de pago con nombre del proveedor, cantidad de comprobantes imputados y creado_por_nombre. Filtros opcionales por proveedor, estado y rango de fechas (por fecha de creacion).';


-- ---------------------------------------------------------------------
-- fn_orden_pago_obtener - cabecera + imputaciones + medios (NUEVA, jsonb)
-- ---------------------------------------------------------------------
create or replace function public.fn_orden_pago_obtener(p_id_orden_pago uuid)
returns jsonb
language sql
stable
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'orden', jsonb_build_object(
      'id_orden_pago', o.id_orden_pago,
      'id_proveedor', o.id_proveedor,
      'nombre_proveedor', p.nombre_proveedor,
      'fecha_prevista', o.fecha_prevista,
      'referencia', o.referencia,
      'observaciones', o.observaciones,
      'estado', o.estado,
      'importe_total', o.importe_total,
      'creado', o.creado,
      'editado', o.editado,
      'creado_por', o.creado_por,
      'creado_por_nombre', coalesce(ur.nombre_completo, 'Usuario no disponible')
    ),
    'comprobantes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', opc.id,
        'id_comprobante', opc.id_comprobante,
        'importe_imputado', opc.importe_imputado,
        'nombre_tipo_comprobante', tc.nombre_tipo_comprobante,
        'letra', tc.letra,
        'numero_formateado',
          lpad(c.punto_venta::text, 5, '0') || '-' || lpad(c.numero::text, 8, '0'),
        'fecha_comprobante', c.fecha_comprobante,
        'fecha_vencimiento', c.fecha_vencimiento,
        'importe_total', c.importe_total,
        'saldo_pendiente', c.saldo_pendiente,
        'estado', c.estado
      ) order by c.fecha_comprobante, c.creado)
      from public.orden_pago_comprobante opc
      join public.comprobante_proveedor c on c.id_comprobante = opc.id_comprobante
      join public.tipo_comprobante tc on tc.id_tipo_comprobante = c.id_tipo_comprobante
      where opc.id_orden_pago = o.id_orden_pago
    ), '[]'::jsonb),
    'medios', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', opm.id,
        'id_medio_pago', opm.id_medio_pago,
        'nombre_medio_pago', mp.nombre_medio_pago,
        'tipo_medio_pago', mp.tipo,
        'id_cuenta_tesoreria', opm.id_cuenta_tesoreria,
        'nombre_cuenta', ct.nombre_cuenta,
        'tipo_cuenta', ct.tipo,
        'importe', opm.importe,
        'referencia', opm.referencia
      ) order by mp.nombre_medio_pago)
      from public.orden_pago_medio opm
      join public.medio_pago mp on mp.id_medio_pago = opm.id_medio_pago
      join public.cuenta_tesoreria ct on ct.id_cuenta = opm.id_cuenta_tesoreria
      where opm.id_orden_pago = o.id_orden_pago
    ), '[]'::jsonb)
  )
  from public.orden_pago o
  join public.proveedor p on p.id_proveedor = o.id_proveedor
  left join public.vw_usuario_resumen ur on ur.id_usuario = o.creado_por
  where o.id_orden_pago = p_id_orden_pago;
$function$;

comment on function public.fn_orden_pago_obtener(uuid) is
  'T-07 | Orden de pago completa como jsonb: { orden, comprobantes[], medios[] }. Devuelve null si no existe.';


-- ---------------------------------------------------------------------
-- fn_comprobante_ordenes_pago_listar - ordenes de un comprobante (NUEVA)
--   Para el detalle del comprobante (T-C1/T-C2).
-- ---------------------------------------------------------------------
create or replace function public.fn_comprobante_ordenes_pago_listar(p_id_comprobante uuid)
returns table (
  id_orden_pago uuid,
  fecha_prevista date,
  referencia text,
  estado public.estado_orden_pago,
  importe_imputado numeric,
  creado timestamptz
)
language sql
stable
set search_path to 'public'
as $function$
  select
    o.id_orden_pago,
    o.fecha_prevista,
    o.referencia,
    o.estado,
    opc.importe_imputado,
    o.creado
  from public.orden_pago_comprobante opc
  join public.orden_pago o on o.id_orden_pago = opc.id_orden_pago
  where opc.id_comprobante = p_id_comprobante
  order by o.creado desc;
$function$;

comment on function public.fn_comprobante_ordenes_pago_listar(uuid) is
  'T-07 | Ordenes de pago que imputan un comprobante, con el importe imputado y el estado de la orden.';


-- ---------------------------------------------------------------------
-- GRANTs explicitos a authenticated (consistencia con T-02)
-- ---------------------------------------------------------------------
grant execute on function public.fn_orden_pago_aplicar_detalle(uuid, uuid, jsonb, jsonb, boolean) to authenticated;
grant execute on function public.fn_orden_pago_crear(uuid, date, text, text, jsonb, jsonb, boolean, uuid) to authenticated;
grant execute on function public.fn_orden_pago_editar(uuid, date, text, text, jsonb, jsonb) to authenticated;
grant execute on function public.fn_orden_pago_confirmar(uuid) to authenticated;
grant execute on function public.fn_orden_pago_cancelar(uuid) to authenticated;
grant execute on function public.fn_orden_pago_listar(uuid, public.estado_orden_pago, date, date) to authenticated;
grant execute on function public.fn_orden_pago_obtener(uuid) to authenticated;
grant execute on function public.fn_comprobante_ordenes_pago_listar(uuid) to authenticated;
