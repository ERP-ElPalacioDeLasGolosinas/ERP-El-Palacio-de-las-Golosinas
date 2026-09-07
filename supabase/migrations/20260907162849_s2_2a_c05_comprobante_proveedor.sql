-- =====================================================================
-- S2-2a | C-05 Registrar comprobante de proveedor
-- Sprint 2 - ERP El Palacio de las Golosinas
--
-- Estado: aplicada en Supabase el 2026-09-07 (migracion 20260907162849).
--
-- Modelo NUEVO (D-010): comprobante_proveedor + comprobante_proveedor_detalle,
-- separado de compra. El vinculo con la orden de compra es una FK nullable
-- (comprobante_proveedor.id_compra). El efecto sobre la deuda del proveedor
-- lo determina tipo_comprobante.signo, no una columna del comprobante.
--
-- - RLS propia para authenticated (D-010), patron <tabla>_<cmd>_authenticated,
--   igual que tipo_comprobante (NO SECURITY DEFINER / D-005).
-- - Alta transaccional cabecera + detalle en una sola RPC (D-011):
--   fn_comprobante_registrar recibe el detalle como jsonb.
-- - Una linea admite id_producto O concepto libre (D-012); el detalle NO
--   alimenta stock.
--
-- Codigos de error (CMP*):
--   CMP01 proveedor inexistente        CMP02 tipo invalido / no aplica_compra
--   CMP03 numeracion invalida          CMP04 duplicado prov+tipo+PV+numero
--   CMP05 importe <= 0                  CMP06 fechas invalidas
--   CMP07 detalle vacio / linea invalida
--   CMP08 comprobante inexistente (reload)
--   CMP09 proveedor inactivo
--   CMP10 diferencia detalle vs total sin confirmar (se afina en S2-2b)
-- =====================================================================


-- ---------------------------------------------------------------------
-- Cabecera
-- ---------------------------------------------------------------------
create table if not exists public.comprobante_proveedor (
  id_comprobante      uuid primary key default gen_random_uuid(),

  id_proveedor        uuid not null references public.proveedor (id_proveedor),
  id_tipo_comprobante uuid not null references public.tipo_comprobante (id_tipo_comprobante),

  punto_venta         integer not null check (punto_venta > 0),
  numero              integer not null check (numero > 0),

  fecha_comprobante   date not null,
  fecha_vencimiento   date,

  importe_total       numeric(14,2) not null check (importe_total > 0),
  saldo_pendiente     numeric(14,2) not null,

  id_compra           uuid references public.compra (id_compra),

  observaciones       text,
  anulado             boolean not null default false,

  creado     timestamptz not null default now(),
  editado    timestamptz not null default now(),
  creado_por uuid not null default auth.uid(),

  constraint comprobante_proveedor_fechas_check
    check (fecha_vencimiento is null or fecha_vencimiento >= fecha_comprobante),
  constraint comprobante_proveedor_unico
    unique (id_proveedor, id_tipo_comprobante, punto_venta, numero)
);

comment on table public.comprobante_proveedor is
  'C-05 | Comprobante de proveedor (factura / NC / ND). Entidad nueva, separada de compra (D-010). El efecto sobre la deuda lo da tipo_comprobante.signo.';

create index if not exists idx_comprobante_proveedor_proveedor
  on public.comprobante_proveedor (id_proveedor);

create index if not exists idx_comprobante_proveedor_pendiente
  on public.comprobante_proveedor (id_proveedor)
  where saldo_pendiente > 0 and anulado = false;


-- ---------------------------------------------------------------------
-- Detalle
-- ---------------------------------------------------------------------
create table if not exists public.comprobante_proveedor_detalle (
  id_detalle     uuid primary key default gen_random_uuid(),
  id_comprobante uuid not null
    references public.comprobante_proveedor (id_comprobante) on delete cascade,

  nro_linea      integer not null check (nro_linea > 0),

  id_producto    uuid references public.producto (id_producto),
  concepto       text,

  cantidad        numeric(14,3) not null check (cantidad > 0),
  precio_unitario numeric(14,2) not null check (precio_unitario >= 0),
  importe_linea   numeric(16,2) generated always as (cantidad * precio_unitario) stored,

  constraint comprobante_detalle_producto_o_concepto_check
    check (id_producto is not null or (concepto is not null and length(trim(concepto)) > 0)),
  constraint comprobante_detalle_linea_unica
    unique (id_comprobante, nro_linea)
);

comment on table public.comprobante_proveedor_detalle is
  'C-05 | Lineas del comprobante. id_producto O concepto libre (D-012). No alimenta stock.';

create index if not exists idx_comprobante_detalle_comprobante
  on public.comprobante_proveedor_detalle (id_comprobante);


-- ---------------------------------------------------------------------
-- Trigger de auditoria (solo cabecera; el detalle no tiene 'editado')
-- ---------------------------------------------------------------------
create or replace function public.set_editado_comprobante_proveedor()
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

drop trigger if exists trg_set_editado_comprobante_proveedor on public.comprobante_proveedor;
create trigger trg_set_editado_comprobante_proveedor
  before update on public.comprobante_proveedor
  for each row execute function public.set_editado_comprobante_proveedor();


-- ---------------------------------------------------------------------
-- Row Level Security - 4 politicas authenticated por tabla (D-010)
-- ---------------------------------------------------------------------
alter table public.comprobante_proveedor enable row level security;

create policy "comprobante_proveedor_select_authenticated"
  on public.comprobante_proveedor for select to authenticated using (true);
create policy "comprobante_proveedor_insert_authenticated"
  on public.comprobante_proveedor for insert to authenticated with check (true);
create policy "comprobante_proveedor_update_authenticated"
  on public.comprobante_proveedor for update to authenticated using (true) with check (true);
create policy "comprobante_proveedor_delete_authenticated"
  on public.comprobante_proveedor for delete to authenticated using (true);

alter table public.comprobante_proveedor_detalle enable row level security;

create policy "comprobante_proveedor_detalle_select_authenticated"
  on public.comprobante_proveedor_detalle for select to authenticated using (true);
create policy "comprobante_proveedor_detalle_insert_authenticated"
  on public.comprobante_proveedor_detalle for insert to authenticated with check (true);
create policy "comprobante_proveedor_detalle_update_authenticated"
  on public.comprobante_proveedor_detalle for update to authenticated using (true) with check (true);
create policy "comprobante_proveedor_detalle_delete_authenticated"
  on public.comprobante_proveedor_detalle for delete to authenticated using (true);


-- ---------------------------------------------------------------------
-- fn_comprobante_registrar - alta transaccional cabecera + detalle (D-011)
-- ---------------------------------------------------------------------
create or replace function public.fn_comprobante_registrar(
  p_id_proveedor uuid,
  p_id_tipo_comprobante uuid,
  p_punto_venta integer,
  p_numero integer,
  p_fecha_comprobante date,
  p_fecha_vencimiento date,
  p_importe_total numeric,
  p_id_compra uuid,
  p_observaciones text,
  p_detalle jsonb,
  p_confirmar_diferencia boolean,
  p_creado_por uuid
)
returns public.comprobante_proveedor
language plpgsql
set search_path to 'public'
as $function$
declare
  v_comprobante   public.comprobante_proveedor;
  v_prov_activo   boolean;
  v_tipo          record;
  v_total_detalle numeric;
  v_invalidas     integer;
begin
  select activo into v_prov_activo
  from public.proveedor where id_proveedor = p_id_proveedor;
  if v_prov_activo is null then
    raise exception 'El proveedor indicado no existe' using errcode = 'CMP01';
  end if;
  if v_prov_activo = false then
    raise exception 'El proveedor esta inactivo y no admite nuevos comprobantes' using errcode = 'CMP09';
  end if;

  select id_tipo_comprobante, aplica_compra
    into v_tipo
  from public.tipo_comprobante where id_tipo_comprobante = p_id_tipo_comprobante;
  if v_tipo.id_tipo_comprobante is null then
    raise exception 'El tipo de comprobante indicado no existe' using errcode = 'CMP02';
  end if;
  if v_tipo.aplica_compra = false then
    raise exception 'El tipo de comprobante seleccionado no aplica a compras' using errcode = 'CMP02';
  end if;

  if p_punto_venta is null or p_punto_venta <= 0 or p_numero is null or p_numero <= 0 then
    raise exception 'El punto de venta y el numero deben ser mayores a cero' using errcode = 'CMP03';
  end if;

  if p_importe_total is null or p_importe_total <= 0 then
    raise exception 'El importe total debe ser mayor a cero' using errcode = 'CMP05';
  end if;

  if p_fecha_comprobante is null then
    raise exception 'La fecha del comprobante es obligatoria' using errcode = 'CMP06';
  end if;
  if p_fecha_vencimiento is not null and p_fecha_vencimiento < p_fecha_comprobante then
    raise exception 'El vencimiento no puede ser anterior a la fecha del comprobante' using errcode = 'CMP06';
  end if;

  if p_detalle is null
     or jsonb_typeof(p_detalle) <> 'array'
     or jsonb_array_length(p_detalle) = 0 then
    raise exception 'El comprobante debe tener al menos una linea de detalle' using errcode = 'CMP07';
  end if;

  select count(*) into v_invalidas
  from jsonb_array_elements(p_detalle) as e(value)
  where coalesce((e.value->>'cantidad')::numeric, 0) <= 0
     or coalesce((e.value->>'precio_unitario')::numeric, 0) < 0
     or (nullif(e.value->>'id_producto', '') is null
         and coalesce(btrim(e.value->>'concepto'), '') = '');
  if v_invalidas > 0 then
    raise exception 'Hay lineas invalidas: cada linea necesita articulo o concepto, cantidad mayor a cero y precio no negativo'
      using errcode = 'CMP07';
  end if;

  select coalesce(sum((e.value->>'cantidad')::numeric * (e.value->>'precio_unitario')::numeric), 0)
    into v_total_detalle
  from jsonb_array_elements(p_detalle) as e(value);

  if round(v_total_detalle, 2) <> round(p_importe_total, 2)
     and coalesce(p_confirmar_diferencia, false) = false then
    raise exception 'La suma del detalle (%) no coincide con el importe total (%). Confirma la diferencia para continuar.',
      to_char(round(v_total_detalle, 2), 'FM999999999990.00'),
      to_char(round(p_importe_total, 2), 'FM999999999990.00')
      using errcode = 'CMP10';
  end if;

  if exists (
    select 1 from public.comprobante_proveedor
    where id_proveedor = p_id_proveedor
      and id_tipo_comprobante = p_id_tipo_comprobante
      and punto_venta = p_punto_venta
      and numero = p_numero
  ) then
    raise exception 'Ya existe un comprobante de ese proveedor, tipo, punto de venta y numero' using errcode = 'CMP04';
  end if;

  begin
    insert into public.comprobante_proveedor (
      id_proveedor, id_tipo_comprobante, punto_venta, numero,
      fecha_comprobante, fecha_vencimiento, importe_total, saldo_pendiente,
      id_compra, observaciones, creado_por
    ) values (
      p_id_proveedor, p_id_tipo_comprobante, p_punto_venta, p_numero,
      p_fecha_comprobante, p_fecha_vencimiento, p_importe_total, p_importe_total,
      p_id_compra, nullif(btrim(p_observaciones), ''), coalesce(p_creado_por, auth.uid())
    )
    returning * into v_comprobante;
  exception
    when unique_violation then
      raise exception 'Ya existe un comprobante de ese proveedor, tipo, punto de venta y numero' using errcode = 'CMP04';
  end;

  insert into public.comprobante_proveedor_detalle (
    id_comprobante, nro_linea, id_producto, concepto, cantidad, precio_unitario
  )
  select
    v_comprobante.id_comprobante,
    e.ord::integer,
    nullif(e.value->>'id_producto', '')::uuid,
    nullif(btrim(e.value->>'concepto'), ''),
    (e.value->>'cantidad')::numeric,
    (e.value->>'precio_unitario')::numeric
  from jsonb_array_elements(p_detalle) with ordinality as e(value, ord);

  return v_comprobante;
end;
$function$;


-- ---------------------------------------------------------------------
-- fn_comprobante_listar - listado enriquecido (D-006)
-- ---------------------------------------------------------------------
create or replace function public.fn_comprobante_listar(
  p_id_proveedor uuid default null,
  p_solo_pendientes boolean default false,
  p_desde date default null,
  p_hasta date default null
)
returns table (
  id_comprobante uuid,
  id_proveedor uuid,
  nombre_proveedor text,
  id_tipo_comprobante uuid,
  nombre_tipo_comprobante text,
  letra character,
  signo smallint,
  punto_venta integer,
  numero integer,
  numero_formateado text,
  fecha_comprobante date,
  fecha_vencimiento date,
  importe_total numeric,
  saldo_pendiente numeric,
  id_compra uuid,
  observaciones text,
  anulado boolean,
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
    c.id_comprobante,
    c.id_proveedor,
    p.nombre_proveedor,
    c.id_tipo_comprobante,
    tc.nombre_tipo_comprobante,
    tc.letra,
    tc.signo,
    c.punto_venta,
    c.numero,
    lpad(c.punto_venta::text, 5, '0') || '-' || lpad(c.numero::text, 8, '0') as numero_formateado,
    c.fecha_comprobante,
    c.fecha_vencimiento,
    c.importe_total,
    c.saldo_pendiente,
    c.id_compra,
    c.observaciones,
    c.anulado,
    c.creado,
    c.editado,
    c.creado_por,
    coalesce(ur.nombre_completo, 'Usuario no disponible') as creado_por_nombre
  from public.comprobante_proveedor c
  join public.proveedor p on p.id_proveedor = c.id_proveedor
  join public.tipo_comprobante tc on tc.id_tipo_comprobante = c.id_tipo_comprobante
  left join public.vw_usuario_resumen ur on ur.id_usuario = c.creado_por
  where (p_id_proveedor is null or c.id_proveedor = p_id_proveedor)
    and (p_solo_pendientes = false or (c.saldo_pendiente > 0 and c.anulado = false))
    and (p_desde is null or c.fecha_comprobante >= p_desde)
    and (p_hasta is null or c.fecha_comprobante <= p_hasta)
  order by c.fecha_comprobante desc, c.creado desc;
$function$;


-- ---------------------------------------------------------------------
-- fn_comprobante_anular - baja logica (D-004)
-- ---------------------------------------------------------------------
create or replace function public.fn_comprobante_anular(p_id_comprobante uuid)
returns public.comprobante_proveedor
language plpgsql
set search_path to 'public'
as $function$
declare
  v_comprobante public.comprobante_proveedor;
begin
  if not exists (select 1 from public.comprobante_proveedor where id_comprobante = p_id_comprobante) then
    raise exception 'El comprobante indicado no existe' using errcode = 'CMP08';
  end if;

  update public.comprobante_proveedor
  set anulado = true
  where id_comprobante = p_id_comprobante
  returning * into v_comprobante;

  return v_comprobante;
end;
$function$;
