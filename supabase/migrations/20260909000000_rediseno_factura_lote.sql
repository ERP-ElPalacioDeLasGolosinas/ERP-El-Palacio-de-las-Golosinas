-- =============================================================================
-- Rediseño: dos circuitos de compra (factura / lote), sin `compra`
-- Plan: ~/.claude/plans/gleaming-conjuring-bachman.md
--
-- - Se eliminan `compra`, `compra_producto` y el enum `estado_compra`.
-- - `comprobante_proveedor` (la factura) gana subtotal / descuento_total /
--   impuesto_total; `importe_total` pasa a calcularse desde el detalle.
-- - `comprobante_proveedor_detalle` gana descuento / impuesto por línea;
--   `importe_linea` pasa a columna generada.
-- - `inventario` (el lote) pierde `id_compra` / `id_proveedor` y gana
--   `id_comprobante` NOT NULL UNIQUE (1 factura = 1 lote).
-- - El lote se registra contra una factura existente
--   (`fn_lote_registrar_desde_comprobante`), no contra una compra.
-- - Se elimina `tipo_comprobante.signo` (el negocio no distingue el signo;
--   ninguna lógica lo usaba).
-- - Se descartan los datos previos de compra / lote / stock (entorno de
--   desarrollo; re-seed manual).
--
-- Reemplaza parcialmente lo definido en:
--   20260907162849_s2_2a_c05_comprobante_proveedor.sql
--   20260907183714_s2_2b_c11_comprobante_detalle.sql
--   20260907190000_tc1_comprobante_estado.sql
--   20260907220000_s2_2c_c12_comprobante_pendientes.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Descartar datos del circuito de stock (no productivo)
-- -----------------------------------------------------------------------------
truncate table public.inventario cascade;          -- cascada: inventario_producto, movimiento_stock_detalle
truncate table public.stock cascade;
truncate table public.movimiento_stock cascade;    -- historial de movimientos (se re-siembra)

-- -----------------------------------------------------------------------------
-- 1. Bajar funciones, vistas y triggers dependientes de `compra`
-- -----------------------------------------------------------------------------
-- Comparativo "pedido vs recibido" (compra_producto vs inventario_producto):
-- obsoleto con el modelo de 2 documentos. Reemplazo eventual = comprobante
-- detalle vs inventario_producto (fuera de alcance).
drop view if exists public.vista_diferencias_recepcion;

drop function if exists public.fn_lote_registrar_desde_compra(uuid, uuid, text, uuid, jsonb);
drop function if exists public.fn_lote_registrar_completo(uuid, uuid, text, uuid, jsonb);
drop function if exists public.fn_aplicar_stock_compra(uuid, uuid, text, jsonb, uuid);
drop function if exists public.fn_compra_listar_disponibles_recepcion();
drop function if exists public.fn_compra_crear(uuid, uuid);
drop function if exists public.fn_items_esperados_compra(uuid);
drop function if exists public.fn_comprobante_detalle_validar(jsonb, numeric);

drop trigger if exists trg_inventario_revertir_stock on public.inventario;
drop trigger if exists trg_inventario_validar_compra on public.inventario;
drop function if exists public.revertir_stock_aplicado();
drop function if exists public.validar_y_marcar_stock_aplicado();
drop function if exists public.validar_cambio_estado_compra() cascade;  -- cascada: trigger trg_compra_validar_estado

-- -----------------------------------------------------------------------------
-- 2. Soltar los vínculos a `compra` y eliminar las tablas
-- -----------------------------------------------------------------------------
alter table public.comprobante_proveedor drop column if exists id_compra;

alter table public.inventario drop constraint if exists uq_inventario_compra;
alter table public.inventario drop column if exists id_compra;
alter table public.inventario drop column if exists id_proveedor;

drop table if exists public.compra_producto;
drop table if exists public.compra;
drop type if exists public.estado_compra;

-- -----------------------------------------------------------------------------
-- 3. Nuevas columnas de la factura
-- -----------------------------------------------------------------------------

-- 3a. Cabecera: desglose calculado desde el detalle.
alter table public.comprobante_proveedor
  add column if not exists subtotal        numeric not null default 0,
  add column if not exists descuento_total numeric not null default 0,
  add column if not exists impuesto_total  numeric not null default 0;

alter table public.comprobante_proveedor
  add constraint chk_comprobante_desglose_no_negativo
  check (subtotal >= 0 and descuento_total >= 0 and impuesto_total >= 0);

-- Backfill de comprobantes previos: el importe tipeado pasa a ser el subtotal
-- (sin descuento ni impuesto discriminado) para que el CHECK de abajo valide.
update public.comprobante_proveedor
set subtotal = importe_total, descuento_total = 0, impuesto_total = 0;

alter table public.comprobante_proveedor
  add constraint chk_comprobante_importe_total_calculado
  check (round(importe_total, 2) = round(subtotal - descuento_total + impuesto_total, 2));

-- 3b. Detalle: descuento / impuesto por línea; importe_linea generado.
alter table public.comprobante_proveedor_detalle
  add column if not exists descuento numeric not null default 0,
  add column if not exists impuesto  numeric not null default 0;

alter table public.comprobante_proveedor_detalle
  add constraint chk_comprobante_detalle_desc_imp_no_negativo
  check (descuento >= 0 and impuesto >= 0);

alter table public.comprobante_proveedor_detalle drop column if exists importe_linea;
alter table public.comprobante_proveedor_detalle
  add column importe_linea numeric
  generated always as (round(cantidad * precio_unitario - descuento + impuesto, 2)) stored;

-- -----------------------------------------------------------------------------
-- 4. El lote se cuelga de la factura
-- -----------------------------------------------------------------------------
alter table public.inventario
  add column id_comprobante uuid not null
  references public.comprobante_proveedor (id_comprobante);

alter table public.inventario
  add constraint uq_inventario_comprobante unique (id_comprobante);

-- =============================================================================
-- 5. Funciones de la factura (reemplazadas)
-- =============================================================================

-- 5a. Alta de comprobante: importe_total y desglose se calculan desde el
--     detalle; descuento / impuesto por línea; sin `id_compra`; sin el flujo
--     de confirmar diferencia (ya no hay total tipeado).
drop function if exists public.fn_comprobante_registrar(uuid, uuid, integer, integer, date, date, numeric, uuid, text, jsonb, boolean, uuid);

create function public.fn_comprobante_registrar(
  p_id_proveedor        uuid,
  p_id_tipo_comprobante  uuid,
  p_punto_venta          integer,
  p_numero               integer,
  p_fecha_comprobante    date,
  p_fecha_vencimiento    date,
  p_observaciones        text,
  p_detalle              jsonb,
  p_creado_por           uuid
)
returns public.comprobante_proveedor
language plpgsql
set search_path to 'public'
as $function$
declare
  v_comprobante     public.comprobante_proveedor;
  v_prov_activo     boolean;
  v_tipo            record;
  v_invalidas       integer;
  v_subtotal        numeric;
  v_descuento_total numeric;
  v_impuesto_total  numeric;
  v_importe_total   numeric;
begin
  select activo into v_prov_activo from public.proveedor where id_proveedor = p_id_proveedor;
  if v_prov_activo is null then
    raise exception 'El proveedor indicado no existe' using errcode = 'CMP01';
  end if;
  if v_prov_activo = false then
    raise exception 'El proveedor esta inactivo y no admite nuevos comprobantes' using errcode = 'CMP09';
  end if;

  select id_tipo_comprobante, aplica_compra into v_tipo
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

  if p_fecha_comprobante is null then
    raise exception 'La fecha del comprobante es obligatoria' using errcode = 'CMP06';
  end if;
  if p_fecha_vencimiento is not null and p_fecha_vencimiento < p_fecha_comprobante then
    raise exception 'El vencimiento no puede ser anterior a la fecha del comprobante' using errcode = 'CMP06';
  end if;

  if p_detalle is null or jsonb_typeof(p_detalle) <> 'array' or jsonb_array_length(p_detalle) = 0 then
    raise exception 'El comprobante debe tener al menos una linea de detalle' using errcode = 'CMP07';
  end if;

  select count(*) into v_invalidas
  from jsonb_array_elements(p_detalle) as e(value)
  where coalesce((e.value->>'cantidad')::numeric, 0) <= 0
     or coalesce((e.value->>'precio_unitario')::numeric, 0) < 0
     or coalesce((e.value->>'descuento')::numeric, 0) < 0
     or coalesce((e.value->>'impuesto')::numeric, 0) < 0
     or (nullif(e.value->>'id_producto', '') is null and coalesce(btrim(e.value->>'concepto'), '') = '');
  if v_invalidas > 0 then
    raise exception 'Hay lineas invalidas: cada linea necesita articulo o concepto, cantidad mayor a cero y montos no negativos' using errcode = 'CMP07';
  end if;

  select
    round(coalesce(sum((e.value->>'cantidad')::numeric * (e.value->>'precio_unitario')::numeric), 0), 2),
    round(coalesce(sum(coalesce((e.value->>'descuento')::numeric, 0)), 0), 2),
    round(coalesce(sum(coalesce((e.value->>'impuesto')::numeric, 0)), 0), 2)
  into v_subtotal, v_descuento_total, v_impuesto_total
  from jsonb_array_elements(p_detalle) as e(value);

  v_importe_total := round(v_subtotal - v_descuento_total + v_impuesto_total, 2);
  if v_importe_total <= 0 then
    raise exception 'El importe total del comprobante debe ser mayor a cero' using errcode = 'CMP05';
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
      fecha_comprobante, fecha_vencimiento,
      subtotal, descuento_total, impuesto_total, importe_total, saldo_pendiente,
      observaciones, estado, creado_por
    ) values (
      p_id_proveedor, p_id_tipo_comprobante, p_punto_venta, p_numero,
      p_fecha_comprobante, p_fecha_vencimiento,
      v_subtotal, v_descuento_total, v_impuesto_total, v_importe_total, v_importe_total,
      nullif(btrim(p_observaciones), ''), 'Pendiente', coalesce(p_creado_por, auth.uid())
    )
    returning * into v_comprobante;
  exception
    when unique_violation then
      raise exception 'Ya existe un comprobante de ese proveedor, tipo, punto de venta y numero' using errcode = 'CMP04';
  end;

  insert into public.comprobante_proveedor_detalle (
    id_comprobante, nro_linea, id_producto, concepto, cantidad, precio_unitario, descuento, impuesto
  )
  select
    v_comprobante.id_comprobante,
    e.ord::integer,
    nullif(e.value->>'id_producto', '')::uuid,
    nullif(btrim(e.value->>'concepto'), ''),
    (e.value->>'cantidad')::numeric,
    (e.value->>'precio_unitario')::numeric,
    coalesce((e.value->>'descuento')::numeric, 0),
    coalesce((e.value->>'impuesto')::numeric, 0)
  from jsonb_array_elements(p_detalle) with ordinality as e(value, ord);

  return v_comprobante;
end;
$function$;

grant execute on function public.fn_comprobante_registrar(uuid, uuid, integer, integer, date, date, text, jsonb, uuid) to authenticated;

-- 5b. Listado: sin `signo` ni `id_compra`; suma el desglose.
drop function if exists public.fn_comprobante_listar(uuid, boolean, date, date, estado_comprobante_proveedor);

create function public.fn_comprobante_listar(
  p_id_proveedor    uuid default null,
  p_solo_pendientes boolean default false,
  p_desde           date default null,
  p_hasta           date default null,
  p_estado          estado_comprobante_proveedor default null
)
returns table(
  id_comprobante uuid, id_proveedor uuid, nombre_proveedor text,
  id_tipo_comprobante uuid, nombre_tipo_comprobante text, letra character,
  punto_venta integer, numero integer, numero_formateado text,
  fecha_comprobante date, fecha_vencimiento date,
  subtotal numeric, descuento_total numeric, impuesto_total numeric,
  importe_total numeric, saldo_pendiente numeric,
  observaciones text, anulado boolean, estado estado_comprobante_proveedor,
  creado timestamptz, editado timestamptz, creado_por uuid, creado_por_nombre text
)
language sql
stable
set search_path to 'public'
as $function$
  select
    c.id_comprobante, c.id_proveedor, p.nombre_proveedor,
    c.id_tipo_comprobante, tc.nombre_tipo_comprobante, tc.letra,
    c.punto_venta, c.numero,
    lpad(c.punto_venta::text, 5, '0') || '-' || lpad(c.numero::text, 8, '0') as numero_formateado,
    c.fecha_comprobante, c.fecha_vencimiento,
    c.subtotal, c.descuento_total, c.impuesto_total,
    c.importe_total, c.saldo_pendiente,
    c.observaciones, c.anulado, c.estado,
    c.creado, c.editado, c.creado_por,
    coalesce(ur.nombre_completo, 'Usuario no disponible') as creado_por_nombre
  from public.comprobante_proveedor c
  join public.proveedor p on p.id_proveedor = c.id_proveedor
  join public.tipo_comprobante tc on tc.id_tipo_comprobante = c.id_tipo_comprobante
  left join public.vw_usuario_resumen ur on ur.id_usuario = c.creado_por
  where (p_id_proveedor is null or c.id_proveedor = p_id_proveedor)
    and (p_solo_pendientes = false or (c.saldo_pendiente > 0 and c.anulado = false))
    and (p_desde is null or c.fecha_comprobante >= p_desde)
    and (p_hasta is null or c.fecha_comprobante <= p_hasta)
    and (p_estado is null or c.estado = p_estado)
  order by c.fecha_comprobante desc, c.creado desc;
$function$;

grant execute on function public.fn_comprobante_listar(uuid, boolean, date, date, estado_comprobante_proveedor) to authenticated;

-- 5c. Detalle de cabecera: sin `signo` ni `id_compra` ni `diferencia`; suma el desglose.
drop function if exists public.fn_comprobante_obtener(uuid);

create function public.fn_comprobante_obtener(p_id_comprobante uuid)
returns table(
  id_comprobante uuid, id_proveedor uuid, nombre_proveedor text,
  id_tipo_comprobante uuid, nombre_tipo_comprobante text, letra character,
  punto_venta integer, numero integer, numero_formateado text,
  fecha_comprobante date, fecha_vencimiento date,
  subtotal numeric, descuento_total numeric, impuesto_total numeric,
  importe_total numeric, saldo_pendiente numeric,
  observaciones text, anulado boolean, estado estado_comprobante_proveedor,
  creado timestamptz, editado timestamptz, creado_por uuid, creado_por_nombre text,
  total_detalle numeric
)
language sql
stable
set search_path to 'public'
as $function$
  select
    c.id_comprobante, c.id_proveedor, p.nombre_proveedor,
    c.id_tipo_comprobante, tc.nombre_tipo_comprobante, tc.letra,
    c.punto_venta, c.numero,
    lpad(c.punto_venta::text, 5, '0') || '-' || lpad(c.numero::text, 8, '0') as numero_formateado,
    c.fecha_comprobante, c.fecha_vencimiento,
    c.subtotal, c.descuento_total, c.impuesto_total,
    c.importe_total, c.saldo_pendiente,
    c.observaciones, c.anulado, c.estado,
    c.creado, c.editado, c.creado_por,
    coalesce(ur.nombre_completo, 'Usuario no disponible') as creado_por_nombre,
    coalesce(d.total_detalle, 0) as total_detalle
  from public.comprobante_proveedor c
  join public.proveedor p on p.id_proveedor = c.id_proveedor
  join public.tipo_comprobante tc on tc.id_tipo_comprobante = c.id_tipo_comprobante
  left join public.vw_usuario_resumen ur on ur.id_usuario = c.creado_por
  left join lateral (
    select round(coalesce(sum(det.importe_linea), 0), 2) as total_detalle
    from public.comprobante_proveedor_detalle det
    where det.id_comprobante = c.id_comprobante
  ) d on true
  where c.id_comprobante = p_id_comprobante;
$function$;

grant execute on function public.fn_comprobante_obtener(uuid) to authenticated;

-- 5d. Detalle de líneas: suma descuento / impuesto.
drop function if exists public.fn_comprobante_detalle_listar(uuid);

create function public.fn_comprobante_detalle_listar(p_id_comprobante uuid)
returns table(
  id_detalle uuid, nro_linea integer, id_producto uuid, nombre_producto text,
  concepto text, cantidad numeric, precio_unitario numeric,
  descuento numeric, impuesto numeric, importe_linea numeric
)
language sql
stable
set search_path to 'public'
as $function$
  select
    det.id_detalle, det.nro_linea, det.id_producto, pr.nombre_producto::text,
    det.concepto, det.cantidad, det.precio_unitario,
    det.descuento, det.impuesto, det.importe_linea
  from public.comprobante_proveedor_detalle det
  left join public.producto pr on pr.id_producto = det.id_producto
  where det.id_comprobante = p_id_comprobante
  order by det.nro_linea;
$function$;

grant execute on function public.fn_comprobante_detalle_listar(uuid) to authenticated;

-- 5e. Pendientes por proveedor: sin `signo`.
drop function if exists public.fn_comprobante_pendientes_listar(uuid, text);

create function public.fn_comprobante_pendientes_listar(
  p_id_proveedor uuid,
  p_orden        text default 'fecha'
)
returns table(
  id_comprobante uuid, id_proveedor uuid, nombre_proveedor text,
  id_tipo_comprobante uuid, nombre_tipo_comprobante text, letra character,
  punto_venta integer, numero integer, numero_formateado text,
  fecha_comprobante date, fecha_vencimiento date,
  importe_total numeric, saldo_pendiente numeric, estado estado_comprobante_proveedor
)
language sql
stable
set search_path to 'public'
as $function$
  select
    c.id_comprobante, c.id_proveedor, p.nombre_proveedor,
    c.id_tipo_comprobante, tc.nombre_tipo_comprobante, tc.letra,
    c.punto_venta, c.numero,
    lpad(c.punto_venta::text, 5, '0') || '-' || lpad(c.numero::text, 8, '0') as numero_formateado,
    c.fecha_comprobante, c.fecha_vencimiento,
    c.importe_total, c.saldo_pendiente, c.estado
  from public.comprobante_proveedor c
  join public.proveedor p on p.id_proveedor = c.id_proveedor
  join public.tipo_comprobante tc on tc.id_tipo_comprobante = c.id_tipo_comprobante
  where c.id_proveedor = p_id_proveedor
    and c.saldo_pendiente > 0
    and c.anulado = false
    and c.estado <> 'Pagado'
  order by
    case when p_orden = 'vencimiento' then c.fecha_vencimiento end asc nulls last,
    c.fecha_comprobante asc,
    c.creado asc;
$function$;

grant execute on function public.fn_comprobante_pendientes_listar(uuid, text) to authenticated;

-- 5f. Facturas de compra disponibles para recepción (sin lote todavía).
create function public.fn_comprobante_listar_para_recepcion()
returns table(
  id_comprobante uuid, id_proveedor uuid, nombre_proveedor text,
  numero_formateado text, fecha_comprobante date, importe_total numeric
)
language sql
stable security definer
set search_path to 'public'
as $function$
  select
    c.id_comprobante, c.id_proveedor, p.nombre_proveedor,
    lpad(c.punto_venta::text, 5, '0') || '-' || lpad(c.numero::text, 8, '0') as numero_formateado,
    c.fecha_comprobante, c.importe_total
  from public.comprobante_proveedor c
  join public.proveedor p on p.id_proveedor = c.id_proveedor
  join public.tipo_comprobante tc on tc.id_tipo_comprobante = c.id_tipo_comprobante
  where tc.aplica_compra = true
    and c.anulado = false
    and not exists (select 1 from public.inventario i where i.id_comprobante = c.id_comprobante)
  order by c.fecha_comprobante desc, c.creado desc;
$function$;

grant execute on function public.fn_comprobante_listar_para_recepcion() to authenticated;

-- =============================================================================
-- 6. Registrar lote contra una factura (reemplaza fn_lote_registrar_desde_compra)
-- =============================================================================
create function public.fn_lote_registrar_desde_comprobante(
  p_id_comprobante uuid,
  p_id_deposito    uuid,
  p_detalle_lote   text,
  p_creado_por     uuid,
  p_productos      jsonb
)
returns table(lote_id uuid, id_comprobante uuid, movimientos jsonb)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_item          jsonb;
  v_id_lote       uuid;
  v_id_marca      uuid;
  v_anulado       boolean;
  v_aplica_compra boolean;
  v_id_tipo_ingreso uuid;
  v_movimientos   jsonb := '[]'::jsonb;
  v_movimiento    public.movimiento_stock;
begin
  if p_productos is null or jsonb_array_length(p_productos) = 0 then
    raise exception 'Debe cargar al menos un producto para registrar el lote' using errcode = 'LOT01';
  end if;

  select c.anulado, tc.aplica_compra
    into v_anulado, v_aplica_compra
  from public.comprobante_proveedor c
  join public.tipo_comprobante tc on tc.id_tipo_comprobante = c.id_tipo_comprobante
  where c.id_comprobante = p_id_comprobante
  for update of c;

  if not found then
    raise exception 'La factura indicada no existe' using errcode = 'LOT07';
  end if;
  if v_aplica_compra = false then
    raise exception 'El comprobante seleccionado no corresponde a una compra' using errcode = 'LOT09';
  end if;
  if v_anulado then
    raise exception 'La factura esta anulada; no admite recepcion de mercaderia' using errcode = 'LOT09';
  end if;
  if exists (select 1 from public.inventario i where i.id_comprobante = p_id_comprobante) then
    raise exception 'La factura ya tiene un lote de recepcion; edite el lote existente' using errcode = 'LOT08';
  end if;

  select tm.id_tipo_movimiento into v_id_tipo_ingreso
  from public.tipo_movimiento tm
  where tm.nombre = 'ingreso por compra' and tm.activo = true;
  if v_id_tipo_ingreso is null then
    raise exception 'No se encontro el tipo de movimiento "ingreso por compra" activo' using errcode = 'LOT06';
  end if;

  insert into public.inventario (id_comprobante, id_deposito, detalle_lote, creado_por)
  values (p_id_comprobante, p_id_deposito, nullif(btrim(p_detalle_lote), ''), coalesce(p_creado_por, auth.uid()))
  returning id_lote into v_id_lote;

  for v_item in select * from jsonb_array_elements(p_productos) loop
    select p.id_marca into v_id_marca
    from public.producto p where p.id_producto = (v_item->>'id_producto')::uuid;
    if v_id_marca is null then
      raise exception 'El producto % no existe', v_item->>'id_producto' using errcode = 'LOT02';
    end if;

    insert into public.inventario_producto (
      id_inventario, id_producto, id_marca, cantidad_inventario,
      fecha_vencimiento, fecha_fabricacion, observaciones, creado_por
    ) values (
      v_id_lote,
      (v_item->>'id_producto')::uuid,
      v_id_marca,
      (v_item->>'cantidad')::numeric,
      (v_item->>'fecha_vencimiento')::date,
      (v_item->>'fecha_elaboracion')::date,
      nullif(btrim(v_item->>'observaciones'), ''),
      coalesce(p_creado_por, auth.uid())
    );
  end loop;

  for v_item in select * from jsonb_array_elements(p_productos) loop
    v_movimiento := public.fn_movimiento_stock_registrar(
      v_id_tipo_ingreso,
      (v_item->>'id_producto')::uuid,
      p_id_deposito,
      (v_item->>'cantidad')::numeric,
      coalesce(p_creado_por, auth.uid())
    );
    v_movimientos := v_movimientos || jsonb_build_object(
      'id_producto', v_item->>'id_producto',
      'id_movimiento', v_movimiento.id_movimiento
    );
  end loop;

  return query select v_id_lote, p_id_comprobante, v_movimientos;
end;
$function$;

grant execute on function public.fn_lote_registrar_desde_comprobante(uuid, uuid, text, uuid, jsonb) to authenticated;

-- =============================================================================
-- 7. Eliminar lote: sin la `compra` de soporte
-- =============================================================================
drop function if exists public.fn_lote_eliminar(uuid, uuid);

create function public.fn_lote_eliminar(p_id_lote uuid, p_creado_por uuid default null)
returns table(movimientos jsonb)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id_deposito     uuid;
  v_consumidos      integer;
  v_creado_por      uuid := coalesce(p_creado_por, auth.uid());
  v_id_tipo_correc  uuid;
  v_row             record;
  v_stock_anterior  numeric;
  v_stock_nuevo     numeric;
  v_id_movimiento   uuid;
  v_movimientos     jsonb := '[]'::jsonb;
begin
  select id_deposito into v_id_deposito
  from public.inventario where id_lote = p_id_lote for update;
  if not found then
    raise exception 'El lote % no existe', p_id_lote using errcode = 'LOT03';
  end if;

  select count(*) into v_consumidos
  from public.inventario_producto
  where id_inventario = p_id_lote and stock_disponible < cantidad_inventario;
  if v_consumidos > 0 then
    raise exception 'No se puede eliminar el lote: tiene % producto(s) con stock ya consumido. Utilice un movimiento de correccion en su lugar.', v_consumidos using errcode = 'LOT04';
  end if;

  select id_tipo_movimiento into v_id_tipo_correc
  from public.tipo_movimiento
  where nombre = 'Corrección - Lote mal ingresado' and activo = true;
  if v_id_tipo_correc is null then
    raise exception 'No se encontro el tipo de movimiento "Corrección - Lote mal ingresado" activo' using errcode = 'LOT06';
  end if;

  for v_row in
    select ip.id_producto, ip.cantidad_inventario
    from public.inventario_producto ip
    where ip.id_inventario = p_id_lote
  loop
    select cantidad into v_stock_anterior
    from public.stock
    where id_producto = v_row.id_producto and id_deposito = v_id_deposito
    for update;
    v_stock_anterior := coalesce(v_stock_anterior, 0);
    v_stock_nuevo := v_stock_anterior - v_row.cantidad_inventario;
    if v_stock_nuevo < 0 then
      raise exception 'Inconsistencia de stock al eliminar el lote: el producto % quedaria con stock negativo', v_row.id_producto using errcode = 'LOT05';
    end if;

    update public.stock
    set cantidad = v_stock_nuevo, editado = now()
    where id_producto = v_row.id_producto and id_deposito = v_id_deposito;

    insert into public.movimiento_stock (
      id_tipo_movimiento, id_producto, id_deposito, cantidad,
      fecha_movimiento, remito, stock_anterior, stock_nuevo, creado_por
    ) values (
      v_id_tipo_correc, v_row.id_producto, v_id_deposito, v_row.cantidad_inventario,
      current_date, 'Eliminación de lote ' || p_id_lote, v_stock_anterior, v_stock_nuevo, v_creado_por
    )
    returning id_movimiento into v_id_movimiento;

    v_movimientos := v_movimientos || jsonb_build_object(
      'id_producto', v_row.id_producto,
      'id_movimiento', v_id_movimiento
    );
  end loop;

  delete from public.inventario where id_lote = p_id_lote;   -- inventario_producto en cascada

  return query select v_movimientos;
end;
$function$;

grant execute on function public.fn_lote_eliminar(uuid, uuid) to authenticated;

-- =============================================================================
-- 8. Guards de baja: apuntar a las tablas nuevas
-- =============================================================================
create or replace function public.fn_producto_eliminar(p_id_producto uuid)
returns void
language plpgsql
set search_path to 'public'
as $function$
declare
  v_comprobantes_count int;
  v_inventario_count   int;
begin
  if not exists (select 1 from public.producto where id_producto = p_id_producto) then
    raise exception 'No se encontró el producto indicado' using errcode = 'PRD04';
  end if;

  select count(*) into v_comprobantes_count
  from public.comprobante_proveedor_detalle where id_producto = p_id_producto;
  select count(*) into v_inventario_count
  from public.inventario_producto where id_producto = p_id_producto;

  if v_comprobantes_count > 0 or v_inventario_count > 0 then
    raise exception 'No se puede eliminar el producto: tiene % linea(s) de comprobante y % movimiento(s) de inventario asociados', v_comprobantes_count, v_inventario_count using errcode = 'PRD09';
  end if;

  delete from public.producto where id_producto = p_id_producto;
end;
$function$;

create or replace function public.fn_proveedor_eliminar(p_id_proveedor uuid)
returns void
language plpgsql
set search_path to 'public'
as $function$
declare
  v_comprobantes_count int;
begin
  if not exists (select 1 from public.proveedor where id_proveedor = p_id_proveedor) then
    raise exception 'No se encontró el proveedor indicado' using errcode = 'PRV05';
  end if;

  select count(*) into v_comprobantes_count
  from public.comprobante_proveedor where id_proveedor = p_id_proveedor;

  if v_comprobantes_count > 0 then
    raise exception 'No se puede eliminar el proveedor: tiene % comprobante(s) asociado(s). Solo puede inhabilitarse.', v_comprobantes_count using errcode = 'PRV08';
  end if;

  delete from public.proveedor where id_proveedor = p_id_proveedor;
end;
$function$;

-- =============================================================================
-- 9. Tipos de comprobante sin `signo`
-- =============================================================================
alter table public.tipo_comprobante drop column if exists signo;

drop function if exists public.fn_tipo_comprobante_listar(boolean, boolean, boolean, boolean);

create function public.fn_tipo_comprobante_listar(
  p_incluir_inactivos boolean default true,
  p_aplica_compra     boolean default null,
  p_aplica_venta      boolean default null,
  p_aplica_pago       boolean default null
)
returns table(
  id_tipo_comprobante uuid, nombre_tipo_comprobante text, letra character,
  es_fiscal boolean, aplica_compra boolean, aplica_venta boolean, aplica_pago boolean,
  activo boolean, creado timestamptz, editado timestamptz,
  creado_por uuid, creado_por_nombre text
)
language sql
stable
set search_path to 'public'
as $function$
  select
    tc.id_tipo_comprobante, tc.nombre_tipo_comprobante, tc.letra,
    tc.es_fiscal, tc.aplica_compra, tc.aplica_venta, tc.aplica_pago,
    tc.activo, tc.creado, tc.editado, tc.creado_por,
    coalesce(ur.nombre_completo, 'Usuario no disponible') as creado_por_nombre
  from public.tipo_comprobante tc
  left join public.vw_usuario_resumen ur on ur.id_usuario = tc.creado_por
  where (p_incluir_inactivos or tc.activo = true)
    and (p_aplica_compra is null or tc.aplica_compra = p_aplica_compra)
    and (p_aplica_venta  is null or tc.aplica_venta  = p_aplica_venta)
    and (p_aplica_pago   is null or tc.aplica_pago   = p_aplica_pago)
  order by tc.nombre_tipo_comprobante;
$function$;

grant execute on function public.fn_tipo_comprobante_listar(boolean, boolean, boolean, boolean) to authenticated;

drop function if exists public.fn_tipo_comprobante_crear(text, smallint, uuid, character, boolean, boolean, boolean, boolean);

create function public.fn_tipo_comprobante_crear(
  p_nombre_tipo_comprobante text,
  p_creado_por              uuid,
  p_letra                   character default null,
  p_es_fiscal               boolean default true,
  p_aplica_compra           boolean default true,
  p_aplica_venta            boolean default false,
  p_aplica_pago             boolean default false
)
returns public.tipo_comprobante
language plpgsql
set search_path to 'public'
as $function$
declare
  v_nombre           text := btrim(p_nombre_tipo_comprobante);
  v_tipo_comprobante public.tipo_comprobante;
begin
  if v_nombre is null or length(v_nombre) = 0 then
    raise exception 'El nombre del tipo de comprobante no puede estar vacío' using errcode = 'CPB01';
  end if;
  if p_letra is not null and p_letra not in ('A', 'B', 'C') then
    raise exception 'La letra debe ser A, B o C (o no informarse)' using errcode = 'CPB05';
  end if;
  if exists (select 1 from public.tipo_comprobante where lower(nombre_tipo_comprobante) = lower(v_nombre)) then
    raise exception 'Ya existe un tipo de comprobante con el nombre "%"', v_nombre using errcode = 'CPB02';
  end if;

  begin
    insert into public.tipo_comprobante (
      nombre_tipo_comprobante, letra, es_fiscal,
      aplica_compra, aplica_venta, aplica_pago, creado_por
    ) values (
      v_nombre, p_letra, coalesce(p_es_fiscal, true),
      coalesce(p_aplica_compra, true), coalesce(p_aplica_venta, false), coalesce(p_aplica_pago, false),
      p_creado_por
    )
    returning * into v_tipo_comprobante;
  exception
    when unique_violation then
      raise exception 'Ya existe un tipo de comprobante con el nombre "%"', v_nombre using errcode = 'CPB02';
  end;

  return v_tipo_comprobante;
end;
$function$;

grant execute on function public.fn_tipo_comprobante_crear(text, uuid, character, boolean, boolean, boolean, boolean) to authenticated;

drop function if exists public.fn_tipo_comprobante_modificar(uuid, text, smallint, character, boolean, boolean, boolean, boolean);

create function public.fn_tipo_comprobante_modificar(
  p_id_tipo_comprobante uuid,
  p_nombre_tipo_comprobante text,
  p_letra           character default null,
  p_es_fiscal       boolean default true,
  p_aplica_compra   boolean default true,
  p_aplica_venta    boolean default false,
  p_aplica_pago     boolean default false
)
returns public.tipo_comprobante
language plpgsql
set search_path to 'public'
as $function$
declare
  v_nombre           text := btrim(p_nombre_tipo_comprobante);
  v_tipo_comprobante public.tipo_comprobante;
begin
  if v_nombre is null or length(v_nombre) = 0 then
    raise exception 'El nombre del tipo de comprobante no puede estar vacío' using errcode = 'CPB01';
  end if;
  if p_letra is not null and p_letra not in ('A', 'B', 'C') then
    raise exception 'La letra debe ser A, B o C (o no informarse)' using errcode = 'CPB05';
  end if;
  if not exists (select 1 from public.tipo_comprobante where id_tipo_comprobante = p_id_tipo_comprobante) then
    raise exception 'No se encontró el tipo de comprobante indicado' using errcode = 'CPB03';
  end if;
  if exists (
    select 1 from public.tipo_comprobante
    where lower(nombre_tipo_comprobante) = lower(v_nombre) and id_tipo_comprobante <> p_id_tipo_comprobante
  ) then
    raise exception 'Ya existe otro tipo de comprobante con el nombre "%"', v_nombre using errcode = 'CPB02';
  end if;

  begin
    update public.tipo_comprobante
    set nombre_tipo_comprobante = v_nombre,
        letra = p_letra,
        es_fiscal = coalesce(p_es_fiscal, es_fiscal),
        aplica_compra = coalesce(p_aplica_compra, aplica_compra),
        aplica_venta = coalesce(p_aplica_venta, aplica_venta),
        aplica_pago = coalesce(p_aplica_pago, aplica_pago)
    where id_tipo_comprobante = p_id_tipo_comprobante
    returning * into v_tipo_comprobante;
  exception
    when unique_violation then
      raise exception 'Ya existe otro tipo de comprobante con el nombre "%"', v_nombre using errcode = 'CPB02';
  end;

  return v_tipo_comprobante;
end;
$function$;

grant execute on function public.fn_tipo_comprobante_modificar(uuid, text, character, boolean, boolean, boolean, boolean) to authenticated;
