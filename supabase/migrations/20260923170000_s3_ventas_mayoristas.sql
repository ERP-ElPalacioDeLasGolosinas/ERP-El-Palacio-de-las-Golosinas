-- Sprint 3 · Ventas mayoristas (S-07, V-10, V-11, V-16, V-19)
--
-- Una sola tabla para la venta y su comprobante (espejo de comprobante_proveedor).
-- Al registrar la venta se descuenta el stock con "Salida por venta".
-- El cobro se registra en Tesorería, cubre el total de la venta, solo se admite
-- con la venta despachada, imputa a cuentas de tesorería y deja la venta "Pagado".

-- ---------------------------------------------------------------------------
-- Tipos y tablas
-- ---------------------------------------------------------------------------

create type public.estado_venta as enum ('En preparación', 'Despachado', 'Pagado');

create table public.comprobante_venta (
  id_comprobante      uuid primary key default gen_random_uuid(),
  id_cliente          uuid not null references public.cliente (id_cliente),
  id_tipo_comprobante uuid not null references public.tipo_comprobante (id_tipo_comprobante),
  punto_venta         integer not null default 1 check (punto_venta > 0),
  numero              integer not null check (numero > 0),
  fecha_comprobante   date not null default current_date,
  canal               public.canal_venta not null default 'Presencial',
  subtotal            numeric not null default 0,
  descuento_total     numeric not null default 0,
  importe_total       numeric not null check (importe_total > 0),
  saldo_pendiente     numeric not null check (saldo_pendiente >= 0),
  observaciones       text,
  estado              public.estado_venta not null default 'En preparación',
  fecha_despacho      timestamptz,
  creado              timestamptz not null default now(),
  editado             timestamptz not null default now(),
  creado_por          uuid not null default auth.uid(),
  constraint comprobante_venta_unico unique (id_tipo_comprobante, punto_venta, numero),
  constraint chk_comprobante_venta_desglose check (subtotal >= 0 and descuento_total >= 0),
  constraint chk_comprobante_venta_total check (round(importe_total, 2) = round(subtotal - descuento_total, 2))
);

create index comprobante_venta_cliente_idx on public.comprobante_venta (id_cliente);
create index comprobante_venta_fecha_idx on public.comprobante_venta (fecha_comprobante desc);

create table public.comprobante_venta_detalle (
  id_detalle      uuid primary key default gen_random_uuid(),
  id_comprobante  uuid not null references public.comprobante_venta (id_comprobante) on delete cascade,
  nro_linea       integer not null check (nro_linea > 0),
  id_producto     uuid not null references public.producto (id_producto),
  id_deposito     uuid not null references public.deposito (id_deposito),
  cantidad        numeric not null check (cantidad > 0),
  precio_unitario numeric not null check (precio_unitario >= 0),
  descuento       numeric not null default 0 check (descuento >= 0),
  importe_linea   numeric generated always as (round(cantidad * precio_unitario - descuento, 2)) stored,
  id_movimiento   uuid references public.movimiento_stock (id_movimiento),
  constraint comprobante_venta_detalle_linea_unica unique (id_comprobante, nro_linea)
);

create index comprobante_venta_detalle_comprobante_idx on public.comprobante_venta_detalle (id_comprobante);
create index comprobante_venta_detalle_movimiento_idx on public.comprobante_venta_detalle (id_movimiento);

create table public.cobro (
  id_cobro       uuid primary key default gen_random_uuid(),
  id_comprobante uuid not null unique references public.comprobante_venta (id_comprobante),
  id_cliente     uuid not null references public.cliente (id_cliente),
  fecha_cobro    date not null default current_date,
  importe_total  numeric not null check (importe_total > 0),
  observaciones  text,
  creado         timestamptz not null default now(),
  editado        timestamptz not null default now(),
  creado_por     uuid not null default auth.uid()
);

create index cobro_cliente_idx on public.cobro (id_cliente);

create table public.cobro_medio (
  id                  uuid primary key default gen_random_uuid(),
  id_cobro            uuid not null references public.cobro (id_cobro) on delete cascade,
  id_medio_pago       uuid not null references public.medio_pago (id_medio_pago),
  id_cuenta_tesoreria uuid not null references public.cuenta_tesoreria (id_cuenta),
  importe             numeric not null check (importe > 0),
  referencia          text
);

create index cobro_medio_cobro_idx on public.cobro_medio (id_cobro);

alter table public.movimiento_tesoreria
  add column id_cobro uuid references public.cobro (id_cobro);

create index movimiento_tesoreria_cobro_idx on public.movimiento_tesoreria (id_cobro);

-- ---------------------------------------------------------------------------
-- Triggers de auditoría
-- ---------------------------------------------------------------------------

create or replace function public.set_editado_comprobante_venta()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.editado    := now();
  new.creado     := old.creado;
  new.creado_por := old.creado_por;
  return new;
end;
$$;

create trigger trg_set_editado_comprobante_venta
before update on public.comprobante_venta
for each row execute function public.set_editado_comprobante_venta();

create or replace function public.set_editado_cobro()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.editado    := now();
  new.creado     := old.creado;
  new.creado_por := old.creado_por;
  return new;
end;
$$;

create trigger trg_set_editado_cobro
before update on public.cobro
for each row execute function public.set_editado_cobro();

-- ---------------------------------------------------------------------------
-- RLS (mismo criterio que comprobante_proveedor / pago, sin DELETE)
-- ---------------------------------------------------------------------------

alter table public.comprobante_venta enable row level security;
alter table public.comprobante_venta_detalle enable row level security;
alter table public.cobro enable row level security;
alter table public.cobro_medio enable row level security;

create policy comprobante_venta_select_authenticated on public.comprobante_venta
  for select to authenticated using (true);
create policy comprobante_venta_insert_authenticated on public.comprobante_venta
  for insert to authenticated with check (true);
create policy comprobante_venta_update_authenticated on public.comprobante_venta
  for update to authenticated using (true) with check (true);

create policy comprobante_venta_detalle_select_authenticated on public.comprobante_venta_detalle
  for select to authenticated using (true);
create policy comprobante_venta_detalle_insert_authenticated on public.comprobante_venta_detalle
  for insert to authenticated with check (true);
create policy comprobante_venta_detalle_update_authenticated on public.comprobante_venta_detalle
  for update to authenticated using (true) with check (true);

create policy cobro_select_authenticated on public.cobro
  for select to authenticated using (true);
create policy cobro_insert_authenticated on public.cobro
  for insert to authenticated with check (true);

create policy cobro_medio_select_authenticated on public.cobro_medio
  for select to authenticated using (true);
create policy cobro_medio_insert_authenticated on public.cobro_medio
  for insert to authenticated with check (true);

-- ---------------------------------------------------------------------------
-- V-10 / V-11 / S-07 · Registrar venta
-- ---------------------------------------------------------------------------
-- p_detalle: [{ id_producto, id_deposito, cantidad, descuento? }]
-- El precio unitario sale de producto.precio_mayorista_producto.

create or replace function public.fn_venta_registrar(
  p_id_cliente uuid,
  p_id_tipo_comprobante uuid,
  p_fecha_comprobante date,
  p_observaciones text,
  p_detalle jsonb,
  p_creado_por uuid
)
returns public.comprobante_venta
language plpgsql
set search_path to 'public'
as $$
declare
  v_venta           public.comprobante_venta;
  v_cliente         record;
  v_tipo            record;
  v_invalidas       integer;
  v_subtotal        numeric;
  v_descuento_total numeric;
  v_importe_total   numeric;
  v_numero          integer;
  v_id_tipo_mov     uuid;
  v_remito          text;
  v_movimiento      public.movimiento_stock;
  r                 record;
begin
  select c.id_cliente, c.activo, c.es_consumidor_final, tc.lista_precio
    into v_cliente
  from public.cliente c
  join public.tipo_cliente tc on tc.id_tipo_cliente = c.id_tipo_cliente
  where c.id_cliente = p_id_cliente;

  if v_cliente.id_cliente is null then
    raise exception 'El cliente indicado no existe' using errcode = 'VTA01';
  end if;
  if v_cliente.activo = false then
    raise exception 'El cliente esta inactivo y no admite nuevas ventas' using errcode = 'VTA01';
  end if;
  if v_cliente.es_consumidor_final or v_cliente.lista_precio <> 'Mayorista' then
    raise exception 'Solo se pueden registrar ventas mayoristas a clientes mayoristas' using errcode = 'VTA02';
  end if;

  select id_tipo_comprobante, aplica_venta, clase, activo into v_tipo
  from public.tipo_comprobante where id_tipo_comprobante = p_id_tipo_comprobante;
  if v_tipo.id_tipo_comprobante is null then
    raise exception 'El tipo de comprobante indicado no existe' using errcode = 'VTA03';
  end if;
  if v_tipo.activo = false or v_tipo.aplica_venta = false or v_tipo.clase <> 'factura' then
    raise exception 'El tipo de comprobante seleccionado no es una factura de venta activa' using errcode = 'VTA03';
  end if;

  if p_fecha_comprobante is null then
    raise exception 'La fecha de la venta es obligatoria' using errcode = 'VTA04';
  end if;
  if p_fecha_comprobante > current_date then
    raise exception 'La fecha de la venta no puede ser futura' using errcode = 'VTA04';
  end if;

  if p_detalle is null or jsonb_typeof(p_detalle) <> 'array' or jsonb_array_length(p_detalle) = 0 then
    raise exception 'La venta debe tener al menos un articulo' using errcode = 'VTA05';
  end if;

  select count(*) into v_invalidas
  from jsonb_array_elements(p_detalle) as e(value)
  where nullif(e.value->>'id_producto', '') is null
     or nullif(e.value->>'id_deposito', '') is null
     or coalesce((e.value->>'cantidad')::numeric, 0) <= 0
     or coalesce((e.value->>'descuento')::numeric, 0) < 0;
  if v_invalidas > 0 then
    raise exception 'Hay lineas invalidas: cada linea necesita articulo, deposito y cantidad mayor a cero' using errcode = 'VTA05';
  end if;

  for r in
    select distinct (e.value->>'id_producto')::uuid as id_producto
    from jsonb_array_elements(p_detalle) as e(value)
  loop
    if not exists (select 1 from public.producto where id_producto = r.id_producto and activo = true) then
      raise exception 'Uno de los articulos no existe o esta inhabilitado' using errcode = 'VTA06';
    end if;
  end loop;

  for r in
    select distinct (e.value->>'id_deposito')::uuid as id_deposito
    from jsonb_array_elements(p_detalle) as e(value)
  loop
    if not exists (select 1 from public.deposito where id_deposito = r.id_deposito and activo = true) then
      raise exception 'Uno de los depositos no existe o esta inhabilitado' using errcode = 'VTA07';
    end if;
  end loop;

  for r in
    select p.nombre_producto, d.nombre_deposito, t.cantidad, coalesce(s.cantidad, 0) as disponible
    from (
      select (e.value->>'id_producto')::uuid as id_producto,
             (e.value->>'id_deposito')::uuid as id_deposito,
             sum((e.value->>'cantidad')::numeric) as cantidad
      from jsonb_array_elements(p_detalle) as e(value)
      group by 1, 2
    ) t
    join public.producto p on p.id_producto = t.id_producto
    join public.deposito d on d.id_deposito = t.id_deposito
    left join public.stock s on s.id_producto = t.id_producto and s.id_deposito = t.id_deposito
  loop
    if r.disponible < r.cantidad then
      raise exception 'Stock insuficiente de "%" en %: disponible %, pedido %',
        r.nombre_producto, r.nombre_deposito, r.disponible, r.cantidad
        using errcode = 'VTA08';
    end if;
  end loop;

  select
    round(coalesce(sum((e.value->>'cantidad')::numeric * p.precio_mayorista_producto), 0), 2),
    round(coalesce(sum(coalesce((e.value->>'descuento')::numeric, 0)), 0), 2)
  into v_subtotal, v_descuento_total
  from jsonb_array_elements(p_detalle) as e(value)
  join public.producto p on p.id_producto = (e.value->>'id_producto')::uuid;

  if exists (
    select 1
    from jsonb_array_elements(p_detalle) as e(value)
    join public.producto p on p.id_producto = (e.value->>'id_producto')::uuid
    where coalesce((e.value->>'descuento')::numeric, 0)
          > round((e.value->>'cantidad')::numeric * p.precio_mayorista_producto, 2)
  ) then
    raise exception 'El descuento de una linea no puede superar su importe' using errcode = 'VTA05';
  end if;

  v_importe_total := round(v_subtotal - v_descuento_total, 2);
  if v_importe_total <= 0 then
    raise exception 'El importe total de la venta debe ser mayor a cero' using errcode = 'VTA11';
  end if;

  perform pg_advisory_xact_lock(hashtext('comprobante_venta:' || p_id_tipo_comprobante::text || ':1'));

  select coalesce(max(numero), 0) + 1 into v_numero
  from public.comprobante_venta
  where id_tipo_comprobante = p_id_tipo_comprobante and punto_venta = 1;

  insert into public.comprobante_venta (
    id_cliente, id_tipo_comprobante, punto_venta, numero, fecha_comprobante,
    subtotal, descuento_total, importe_total, saldo_pendiente,
    observaciones, estado, creado_por
  ) values (
    p_id_cliente, p_id_tipo_comprobante, 1, v_numero, p_fecha_comprobante,
    v_subtotal, v_descuento_total, v_importe_total, v_importe_total,
    nullif(btrim(p_observaciones), ''), 'En preparación', coalesce(p_creado_por, auth.uid())
  )
  returning * into v_venta;

  insert into public.comprobante_venta_detalle (
    id_comprobante, nro_linea, id_producto, id_deposito, cantidad, precio_unitario, descuento
  )
  select
    v_venta.id_comprobante,
    e.ord::integer,
    (e.value->>'id_producto')::uuid,
    (e.value->>'id_deposito')::uuid,
    (e.value->>'cantidad')::numeric,
    p.precio_mayorista_producto,
    round(coalesce((e.value->>'descuento')::numeric, 0), 2)
  from jsonb_array_elements(p_detalle) with ordinality as e(value, ord)
  join public.producto p on p.id_producto = (e.value->>'id_producto')::uuid;

  select id_tipo_movimiento into v_id_tipo_mov
  from public.tipo_movimiento
  where lower(btrim(nombre)) = 'salida por venta' and activo = true;
  if v_id_tipo_mov is null then
    raise exception 'No existe el tipo de movimiento "Salida por venta" activo' using errcode = 'VTA12';
  end if;

  v_remito := 'Venta ' || lpad(v_venta.punto_venta::text, 5, '0') || '-' || lpad(v_venta.numero::text, 8, '0');

  for r in
    select id_detalle, id_producto, id_deposito, cantidad
    from public.comprobante_venta_detalle
    where id_comprobante = v_venta.id_comprobante
    order by nro_linea
  loop
    v_movimiento := public.fn_movimiento_stock_registrar(
      v_id_tipo_mov, r.id_producto, r.id_deposito, r.cantidad,
      coalesce(p_creado_por, auth.uid()), p_fecha_comprobante, v_remito, null
    );

    update public.comprobante_venta_detalle
    set id_movimiento = v_movimiento.id_movimiento
    where id_detalle = r.id_detalle;
  end loop;

  return v_venta;
end;
$$;

-- ---------------------------------------------------------------------------
-- Despachar venta (En preparación → Despachado)
-- ---------------------------------------------------------------------------

create or replace function public.fn_venta_despachar(p_id_comprobante uuid)
returns public.comprobante_venta
language plpgsql
set search_path to 'public'
as $$
declare
  v_venta public.comprobante_venta;
begin
  select * into v_venta
  from public.comprobante_venta
  where id_comprobante = p_id_comprobante
  for update;

  if v_venta.id_comprobante is null then
    raise exception 'La venta indicada no existe' using errcode = 'VTA09';
  end if;
  if v_venta.estado <> 'En preparación' then
    raise exception 'Solo se puede despachar una venta en preparacion (estado actual: %)', v_venta.estado
      using errcode = 'VTA10';
  end if;

  update public.comprobante_venta
  set estado = 'Despachado', fecha_despacho = now()
  where id_comprobante = p_id_comprobante
  returning * into v_venta;

  return v_venta;
end;
$$;

-- ---------------------------------------------------------------------------
-- V-19 · Historial y detalle
-- ---------------------------------------------------------------------------

create or replace function public.fn_venta_listar(
  p_id_cliente uuid default null,
  p_desde date default null,
  p_hasta date default null,
  p_estado public.estado_venta default null
)
returns table (
  id_comprobante uuid,
  id_cliente uuid,
  nombre_cliente text,
  id_tipo_comprobante uuid,
  nombre_tipo_comprobante text,
  letra character,
  punto_venta integer,
  numero integer,
  numero_formateado text,
  fecha_comprobante date,
  importe_total numeric,
  saldo_pendiente numeric,
  estado public.estado_venta,
  cantidad_articulos bigint,
  id_cobro uuid,
  creado timestamptz,
  creado_por uuid,
  creado_por_nombre text
)
language sql
stable
set search_path to 'public'
as $$
  select
    v.id_comprobante,
    v.id_cliente,
    c.nombre_cliente,
    v.id_tipo_comprobante,
    tc.nombre_tipo_comprobante,
    tc.letra,
    v.punto_venta,
    v.numero,
    lpad(v.punto_venta::text, 5, '0') || '-' || lpad(v.numero::text, 8, '0') as numero_formateado,
    v.fecha_comprobante,
    v.importe_total,
    v.saldo_pendiente,
    v.estado,
    (select count(*) from public.comprobante_venta_detalle d where d.id_comprobante = v.id_comprobante) as cantidad_articulos,
    cb.id_cobro,
    v.creado,
    v.creado_por,
    coalesce(u.nombre_completo, 'Usuario no disponible') as creado_por_nombre
  from public.comprobante_venta v
  join public.cliente c on c.id_cliente = v.id_cliente
  join public.tipo_comprobante tc on tc.id_tipo_comprobante = v.id_tipo_comprobante
  left join public.cobro cb on cb.id_comprobante = v.id_comprobante
  left join public.vw_usuario_resumen u on u.id_usuario = v.creado_por
  where (p_id_cliente is null or v.id_cliente = p_id_cliente)
    and (p_desde is null or v.fecha_comprobante >= p_desde)
    and (p_hasta is null or v.fecha_comprobante <= p_hasta)
    and (p_estado is null or v.estado = p_estado)
  order by v.fecha_comprobante desc, v.creado desc;
$$;

create or replace function public.fn_venta_obtener(p_id_comprobante uuid)
returns jsonb
language sql
stable
set search_path to 'public'
as $$
  select jsonb_build_object(
    'venta', jsonb_build_object(
      'id_comprobante', v.id_comprobante,
      'id_cliente', v.id_cliente,
      'nombre_cliente', c.nombre_cliente,
      'documento_cliente', c.documento_cliente,
      'telefono_cliente', c.telefono_cliente,
      'direccion_cliente', c.direccion_cliente,
      'nombre_tipo_cliente', tcl.nombre_tipo_cliente,
      'id_tipo_comprobante', v.id_tipo_comprobante,
      'nombre_tipo_comprobante', tc.nombre_tipo_comprobante,
      'letra', tc.letra,
      'punto_venta', v.punto_venta,
      'numero', v.numero,
      'numero_formateado', lpad(v.punto_venta::text, 5, '0') || '-' || lpad(v.numero::text, 8, '0'),
      'fecha_comprobante', v.fecha_comprobante,
      'canal', v.canal,
      'subtotal', v.subtotal,
      'descuento_total', v.descuento_total,
      'importe_total', v.importe_total,
      'saldo_pendiente', v.saldo_pendiente,
      'observaciones', v.observaciones,
      'estado', v.estado,
      'fecha_despacho', v.fecha_despacho,
      'creado', v.creado,
      'creado_por', v.creado_por,
      'creado_por_nombre', coalesce(u.nombre_completo, 'Usuario no disponible')
    ),
    'detalle', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id_detalle', d.id_detalle,
        'nro_linea', d.nro_linea,
        'id_producto', d.id_producto,
        'codigo_producto', p.codigo_producto,
        'nombre_completo', p.nombre_producto || ' - ' || m.nombre_marca || ' (' || p.numero_medida || ' ' || um.abreviatura || ')',
        'id_deposito', d.id_deposito,
        'nombre_deposito', dep.nombre_deposito,
        'cantidad', d.cantidad,
        'precio_unitario', d.precio_unitario,
        'descuento', d.descuento,
        'importe_linea', d.importe_linea,
        'id_movimiento', d.id_movimiento
      ) order by d.nro_linea)
      from public.comprobante_venta_detalle d
      join public.producto p on p.id_producto = d.id_producto
      join public.marca m on m.id_marca = p.id_marca
      join public.unidad_medida um on um.id_unidad_medida = p.id_unidad_medida
      join public.deposito dep on dep.id_deposito = d.id_deposito
      where d.id_comprobante = v.id_comprobante
    ), '[]'::jsonb),
    'cobro', (
      select jsonb_build_object(
        'id_cobro', cb.id_cobro,
        'fecha_cobro', cb.fecha_cobro,
        'importe_total', cb.importe_total,
        'creado_por_nombre', coalesce(uc.nombre_completo, 'Usuario no disponible')
      )
      from public.cobro cb
      left join public.vw_usuario_resumen uc on uc.id_usuario = cb.creado_por
      where cb.id_comprobante = v.id_comprobante
    )
  )
  from public.comprobante_venta v
  join public.cliente c on c.id_cliente = v.id_cliente
  join public.tipo_cliente tcl on tcl.id_tipo_cliente = c.id_tipo_cliente
  join public.tipo_comprobante tc on tc.id_tipo_comprobante = v.id_tipo_comprobante
  left join public.vw_usuario_resumen u on u.id_usuario = v.creado_por
  where v.id_comprobante = p_id_comprobante;
$$;

-- ---------------------------------------------------------------------------
-- V-16 · Cobro de la venta (Tesorería)
-- ---------------------------------------------------------------------------
-- p_medios: [{ id_medio_pago, id_cuenta_tesoreria, importe, referencia? }]
-- La suma de los medios tiene que ser igual al total de la venta.

create or replace function public.fn_cobro_registrar(
  p_id_comprobante uuid,
  p_fecha_cobro date,
  p_observaciones text,
  p_medios jsonb,
  p_creado_por uuid
)
returns public.cobro
language plpgsql
set search_path to 'public'
as $$
declare
  v_venta       public.comprobante_venta;
  v_cobro       public.cobro;
  v_medio       record;
  v_activo      boolean;
  v_suma        numeric;
  v_cliente     text;
  v_numero      text;
  v_saldo_ant   numeric;
  r             record;
begin
  select * into v_venta
  from public.comprobante_venta
  where id_comprobante = p_id_comprobante
  for update;

  if v_venta.id_comprobante is null then
    raise exception 'La venta indicada no existe' using errcode = 'COB01';
  end if;
  if v_venta.estado = 'Pagado' then
    raise exception 'La venta ya esta cobrada' using errcode = 'COB02';
  end if;
  if v_venta.estado <> 'Despachado' then
    raise exception 'Solo se puede cobrar una venta despachada' using errcode = 'COB02';
  end if;

  if p_fecha_cobro is not null and p_fecha_cobro > current_date then
    raise exception 'La fecha del cobro no puede ser futura' using errcode = 'COB07';
  end if;

  if p_medios is null or jsonb_typeof(p_medios) <> 'array' or jsonb_array_length(p_medios) = 0 then
    raise exception 'El cobro debe tener al menos un medio de pago' using errcode = 'COB03';
  end if;

  for r in
    select (e.value->>'id_medio_pago')::uuid as id_medio_pago,
           (e.value->>'id_cuenta_tesoreria')::uuid as id_cuenta_tesoreria,
           (e.value->>'importe')::numeric as importe,
           nullif(btrim(e.value->>'referencia'), '') as referencia
    from jsonb_array_elements(p_medios) as e(value)
  loop
    if r.importe is null or r.importe <= 0 then
      raise exception 'El importe de cada medio de pago debe ser mayor a cero' using errcode = 'COB03';
    end if;

    select nombre_medio_pago, tipo, requiere_referencia, activo into v_medio
    from public.medio_pago where id_medio_pago = r.id_medio_pago;
    if v_medio.nombre_medio_pago is null then
      raise exception 'Uno de los medios de pago no existe' using errcode = 'COB04';
    end if;
    if v_medio.activo = false then
      raise exception 'El medio de pago "%" esta inactivo', v_medio.nombre_medio_pago using errcode = 'COB04';
    end if;
    if v_medio.tipo = 'Cheque propio' then
      raise exception 'Un cobro no puede recibirse con cheque propio' using errcode = 'COB06';
    end if;
    if v_medio.requiere_referencia and r.referencia is null then
      raise exception 'El medio de pago "%" requiere una referencia', v_medio.nombre_medio_pago using errcode = 'COB05';
    end if;

    select activo into v_activo from public.cuenta_tesoreria where id_cuenta = r.id_cuenta_tesoreria;
    if v_activo is null then
      raise exception 'Una de las cuentas de tesoreria no existe' using errcode = 'COB04';
    end if;
    if v_activo = false then
      raise exception 'Una de las cuentas de tesoreria esta inactiva' using errcode = 'COB04';
    end if;
    if not exists (
      select 1 from public.medio_pago_cuenta
      where id_medio_pago = r.id_medio_pago and id_cuenta_tesoreria = r.id_cuenta_tesoreria
    ) then
      raise exception 'La cuenta elegida no esta habilitada para el medio "%"', v_medio.nombre_medio_pago
        using errcode = 'COB04';
    end if;
  end loop;

  select round(coalesce(sum((e.value->>'importe')::numeric), 0), 2) into v_suma
  from jsonb_array_elements(p_medios) as e(value);

  if v_suma <> round(v_venta.saldo_pendiente, 2) then
    raise exception 'La suma de los medios (%) tiene que ser igual al total de la venta (%)',
      to_char(v_suma, 'FM999999999990.00'),
      to_char(round(v_venta.saldo_pendiente, 2), 'FM999999999990.00')
      using errcode = 'COB03';
  end if;

  select nombre_cliente into v_cliente from public.cliente where id_cliente = v_venta.id_cliente;
  v_numero := lpad(v_venta.punto_venta::text, 5, '0') || '-' || lpad(v_venta.numero::text, 8, '0');

  insert into public.cobro (
    id_comprobante, id_cliente, fecha_cobro, importe_total, observaciones, creado_por
  ) values (
    v_venta.id_comprobante, v_venta.id_cliente, coalesce(p_fecha_cobro, current_date),
    v_suma, nullif(btrim(p_observaciones), ''), coalesce(p_creado_por, auth.uid())
  )
  returning * into v_cobro;

  insert into public.cobro_medio (id_cobro, id_medio_pago, id_cuenta_tesoreria, importe, referencia)
  select v_cobro.id_cobro,
         (e.value->>'id_medio_pago')::uuid,
         (e.value->>'id_cuenta_tesoreria')::uuid,
         round((e.value->>'importe')::numeric, 2),
         nullif(btrim(e.value->>'referencia'), '')
  from jsonb_array_elements(p_medios) as e(value);

  for r in
    select cm.id_cuenta_tesoreria, cm.importe, cm.referencia
    from public.cobro_medio cm
    where cm.id_cobro = v_cobro.id_cobro
  loop
    select saldo_actual into v_saldo_ant
    from public.cuenta_tesoreria where id_cuenta = r.id_cuenta_tesoreria
    for update;

    insert into public.movimiento_tesoreria (
      id_cuenta_tesoreria, tipo, importe, fecha, referencia, descripcion,
      id_cobro, saldo_anterior, saldo_nuevo, creado_por
    ) values (
      r.id_cuenta_tesoreria, 'Ingreso', r.importe, v_cobro.fecha_cobro, r.referencia,
      'Cobro venta ' || v_numero || ' a ' || coalesce(v_cliente, 'cliente'),
      v_cobro.id_cobro, round(v_saldo_ant, 2), round(v_saldo_ant + r.importe, 2),
      coalesce(p_creado_por, auth.uid())
    );

    update public.cuenta_tesoreria
    set saldo_actual = round(saldo_actual + r.importe, 2)
    where id_cuenta = r.id_cuenta_tesoreria;
  end loop;

  update public.comprobante_venta
  set saldo_pendiente = 0, estado = 'Pagado'
  where id_comprobante = v_venta.id_comprobante;

  return v_cobro;
end;
$$;

create or replace function public.fn_cobro_listar(
  p_id_cliente uuid default null,
  p_desde date default null,
  p_hasta date default null
)
returns table (
  id_cobro uuid,
  id_comprobante uuid,
  id_cliente uuid,
  nombre_cliente text,
  nombre_tipo_comprobante text,
  letra character,
  numero_formateado text,
  fecha_cobro date,
  importe_total numeric,
  medios text,
  creado timestamptz,
  creado_por uuid,
  creado_por_nombre text
)
language sql
stable
set search_path to 'public'
as $$
  select
    cb.id_cobro,
    cb.id_comprobante,
    cb.id_cliente,
    c.nombre_cliente,
    tc.nombre_tipo_comprobante,
    tc.letra,
    lpad(v.punto_venta::text, 5, '0') || '-' || lpad(v.numero::text, 8, '0') as numero_formateado,
    cb.fecha_cobro,
    cb.importe_total,
    (
      select string_agg(distinct mp.nombre_medio_pago, ', ')
      from public.cobro_medio cm
      join public.medio_pago mp on mp.id_medio_pago = cm.id_medio_pago
      where cm.id_cobro = cb.id_cobro
    ) as medios,
    cb.creado,
    cb.creado_por,
    coalesce(u.nombre_completo, 'Usuario no disponible') as creado_por_nombre
  from public.cobro cb
  join public.comprobante_venta v on v.id_comprobante = cb.id_comprobante
  join public.cliente c on c.id_cliente = cb.id_cliente
  join public.tipo_comprobante tc on tc.id_tipo_comprobante = v.id_tipo_comprobante
  left join public.vw_usuario_resumen u on u.id_usuario = cb.creado_por
  where (p_id_cliente is null or cb.id_cliente = p_id_cliente)
    and (p_desde is null or cb.fecha_cobro >= p_desde)
    and (p_hasta is null or cb.fecha_cobro <= p_hasta)
  order by cb.fecha_cobro desc, cb.creado desc;
$$;

create or replace function public.fn_cobro_obtener(p_id_cobro uuid)
returns jsonb
language sql
stable
set search_path to 'public'
as $$
  select jsonb_build_object(
    'cobro', jsonb_build_object(
      'id_cobro', cb.id_cobro,
      'id_comprobante', cb.id_comprobante,
      'id_cliente', cb.id_cliente,
      'nombre_cliente', c.nombre_cliente,
      'nombre_tipo_comprobante', tc.nombre_tipo_comprobante,
      'letra', tc.letra,
      'numero_formateado', lpad(v.punto_venta::text, 5, '0') || '-' || lpad(v.numero::text, 8, '0'),
      'fecha_comprobante', v.fecha_comprobante,
      'estado_venta', v.estado,
      'fecha_cobro', cb.fecha_cobro,
      'importe_total', cb.importe_total,
      'observaciones', cb.observaciones,
      'creado', cb.creado,
      'creado_por', cb.creado_por,
      'creado_por_nombre', coalesce(u.nombre_completo, 'Usuario no disponible')
    ),
    'medios', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', cm.id,
        'id_medio_pago', cm.id_medio_pago,
        'nombre_medio_pago', mp.nombre_medio_pago,
        'tipo_medio_pago', mp.tipo,
        'id_cuenta_tesoreria', cm.id_cuenta_tesoreria,
        'nombre_cuenta', ct.nombre_cuenta,
        'tipo_cuenta', ct.tipo,
        'importe', cm.importe,
        'referencia', cm.referencia
      ) order by mp.nombre_medio_pago)
      from public.cobro_medio cm
      join public.medio_pago mp on mp.id_medio_pago = cm.id_medio_pago
      join public.cuenta_tesoreria ct on ct.id_cuenta = cm.id_cuenta_tesoreria
      where cm.id_cobro = cb.id_cobro
    ), '[]'::jsonb),
    'movimientos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id_movimiento', m.id_movimiento,
        'id_cuenta_tesoreria', m.id_cuenta_tesoreria,
        'nombre_cuenta', ct.nombre_cuenta,
        'tipo', m.tipo,
        'importe', m.importe,
        'fecha', m.fecha,
        'saldo_anterior', m.saldo_anterior,
        'saldo_nuevo', m.saldo_nuevo,
        'referencia', m.referencia,
        'descripcion', m.descripcion
      ) order by m.creado)
      from public.movimiento_tesoreria m
      join public.cuenta_tesoreria ct on ct.id_cuenta = m.id_cuenta_tesoreria
      where m.id_cobro = cb.id_cobro
    ), '[]'::jsonb)
  )
  from public.cobro cb
  join public.comprobante_venta v on v.id_comprobante = cb.id_comprobante
  join public.cliente c on c.id_cliente = cb.id_cliente
  join public.tipo_comprobante tc on tc.id_tipo_comprobante = v.id_tipo_comprobante
  left join public.vw_usuario_resumen u on u.id_usuario = cb.creado_por
  where cb.id_cobro = p_id_cobro;
$$;

-- ---------------------------------------------------------------------------
-- S-07 · El historial de movimientos muestra la venta que originó el egreso
-- ---------------------------------------------------------------------------

create or replace function public.fn_movimiento_stock_listar(
  p_id_producto uuid default null,
  p_id_deposito uuid default null,
  p_id_tipo_movimiento uuid default null,
  p_fecha_desde date default null,
  p_fecha_hasta date default null
)
returns table (
  id_movimiento uuid, id_tipo_movimiento uuid, tipo_movimiento_nombre text, signo smallint,
  id_producto uuid, nombre_producto text, nombre_marca text, numero_medida numeric,
  abreviatura_unidad_medida text, producto_nombre_completo text, id_deposito uuid,
  nombre_deposito text, cantidad numeric, valor numeric, fecha_movimiento date, remito text,
  documento_ligado text, stock_anterior numeric, stock_nuevo numeric, creado timestamptz,
  creado_por uuid, creado_por_nombre text, id_movimiento_referencia uuid,
  referencia_tipo_movimiento_nombre text, referencia_fecha_movimiento date
)
language sql
stable
set search_path to 'public'
as $$
  select
    ms.id_movimiento,
    ms.id_tipo_movimiento,
    tm.nombre as tipo_movimiento_nombre,
    tm.signo,
    ms.id_producto,
    p.nombre_producto,
    m.nombre_marca,
    p.numero_medida,
    um.abreviatura as abreviatura_unidad_medida,
    p.nombre_producto || ' - ' || m.nombre_marca || ' (' || p.numero_medida || ' ' || um.abreviatura || ')' as producto_nombre_completo,
    ms.id_deposito,
    d.nombre_deposito,
    ms.cantidad,
    (tm.signo * ms.cantidad) as valor,
    ms.fecha_movimiento,
    ms.remito,
    case
      when cv.id_comprobante is not null then
        'Venta ' || tcv.nombre_tipo_comprobante || ' '
        || lpad(cv.punto_venta::text, 5, '0') || '-' || lpad(cv.numero::text, 8, '0')
    end as documento_ligado,
    ms.stock_anterior,
    ms.stock_nuevo,
    ms.creado,
    ms.creado_por,
    coalesce(u.nombre_completo, 'Usuario no disponible') as creado_por_nombre,
    ms.id_movimiento_referencia,
    tm_ref.nombre as referencia_tipo_movimiento_nombre,
    ms_ref.fecha_movimiento as referencia_fecha_movimiento
  from public.movimiento_stock ms
  join public.tipo_movimiento tm on tm.id_tipo_movimiento = ms.id_tipo_movimiento
  join public.producto p on p.id_producto = ms.id_producto
  join public.marca m on m.id_marca = p.id_marca
  join public.unidad_medida um on um.id_unidad_medida = p.id_unidad_medida
  join public.deposito d on d.id_deposito = ms.id_deposito
  left join public.vw_usuario_resumen u on u.id_usuario = ms.creado_por
  left join public.movimiento_stock ms_ref on ms_ref.id_movimiento = ms.id_movimiento_referencia
  left join public.tipo_movimiento tm_ref on tm_ref.id_tipo_movimiento = ms_ref.id_tipo_movimiento
  left join public.comprobante_venta_detalle cvd on cvd.id_movimiento = ms.id_movimiento
  left join public.comprobante_venta cv on cv.id_comprobante = cvd.id_comprobante
  left join public.tipo_comprobante tcv on tcv.id_tipo_comprobante = cv.id_tipo_comprobante
  where (p_id_producto is null or ms.id_producto = p_id_producto)
    and (p_id_deposito is null or ms.id_deposito = p_id_deposito)
    and (p_id_tipo_movimiento is null or ms.id_tipo_movimiento = p_id_tipo_movimiento)
    and (p_fecha_desde is null or ms.fecha_movimiento >= p_fecha_desde)
    and (p_fecha_hasta is null or ms.fecha_movimiento <= p_fecha_hasta)
  order by ms.fecha_movimiento desc, ms.creado desc;
$$;

-- ---------------------------------------------------------------------------
-- Permisos: solo usuarios autenticados
-- ---------------------------------------------------------------------------

revoke execute on function public.fn_venta_registrar(uuid, uuid, date, text, jsonb, uuid) from public, anon;
revoke execute on function public.fn_venta_despachar(uuid) from public, anon;
revoke execute on function public.fn_venta_listar(uuid, date, date, public.estado_venta) from public, anon;
revoke execute on function public.fn_venta_obtener(uuid) from public, anon;
revoke execute on function public.fn_cobro_registrar(uuid, date, text, jsonb, uuid) from public, anon;
revoke execute on function public.fn_cobro_listar(uuid, date, date) from public, anon;
revoke execute on function public.fn_cobro_obtener(uuid) from public, anon;

grant execute on function public.fn_venta_registrar(uuid, uuid, date, text, jsonb, uuid) to authenticated, service_role;
grant execute on function public.fn_venta_despachar(uuid) to authenticated, service_role;
grant execute on function public.fn_venta_listar(uuid, date, date, public.estado_venta) to authenticated, service_role;
grant execute on function public.fn_venta_obtener(uuid) to authenticated, service_role;
grant execute on function public.fn_cobro_registrar(uuid, date, text, jsonb, uuid) to authenticated, service_role;
grant execute on function public.fn_cobro_listar(uuid, date, date) to authenticated, service_role;
grant execute on function public.fn_cobro_obtener(uuid) to authenticated, service_role;
