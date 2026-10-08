-- S-02 umbrales, S-11 alertas, C-03/C-04 orden de compra.
-- Una factura nueva se vincula a una orden. La recepcion (lote) acumula
-- cantidad_recibida y no puede pasar la cantidad solicitada.

-- ---------------------------------------------------------------------
-- Umbral de stock por articulo y deposito
-- ---------------------------------------------------------------------
create table if not exists public.stock_umbral (
  id_umbral     uuid primary key default gen_random_uuid(),
  id_producto   uuid not null references public.producto (id_producto),
  id_deposito   uuid not null references public.deposito (id_deposito),
  stock_minimo  numeric(14,3) check (stock_minimo is null or stock_minimo >= 0),
  stock_maximo  numeric(14,3) check (stock_maximo is null or stock_maximo >= 0),
  creado        timestamptz not null default now(),
  editado       timestamptz not null default now(),
  creado_por    uuid not null default auth.uid(),
  constraint stock_umbral_producto_deposito_uq unique (id_producto, id_deposito),
  constraint stock_umbral_min_max_check check (
    stock_minimo is null or stock_maximo is null or stock_minimo <= stock_maximo
  ),
  constraint stock_umbral_alguno_check check (
    stock_minimo is not null or stock_maximo is not null
  )
);

alter table public.stock_umbral enable row level security;
drop policy if exists stock_umbral_select_authenticated on public.stock_umbral;
drop policy if exists stock_umbral_insert_authenticated on public.stock_umbral;
drop policy if exists stock_umbral_update_authenticated on public.stock_umbral;
drop policy if exists stock_umbral_delete_authenticated on public.stock_umbral;
create policy stock_umbral_select_authenticated on public.stock_umbral for select to authenticated using (true);
create policy stock_umbral_insert_authenticated on public.stock_umbral for insert to authenticated with check (true);
create policy stock_umbral_update_authenticated on public.stock_umbral for update to authenticated using (true) with check (true);
create policy stock_umbral_delete_authenticated on public.stock_umbral for delete to authenticated using (true);
grant select, insert, update, delete on public.stock_umbral to authenticated, service_role;

create or replace function public.fn_stock_umbral_guardar(
  p_id_producto uuid,
  p_id_deposito uuid,
  p_stock_minimo numeric,
  p_stock_maximo numeric,
  p_creado_por uuid default null
)
returns void
language plpgsql
set search_path to 'public'
as $$
declare
  v_min numeric := case when p_stock_minimo is null then null else round(p_stock_minimo, 3) end;
  v_max numeric := case when p_stock_maximo is null then null else round(p_stock_maximo, 3) end;
begin
  if not exists (select 1 from public.producto where id_producto = p_id_producto and activo) then
    raise exception 'El articulo indicado no existe o esta inactivo' using errcode = 'STU01';
  end if;
  if not exists (select 1 from public.deposito where id_deposito = p_id_deposito and activo) then
    raise exception 'El deposito indicado no existe o esta inactivo' using errcode = 'STU02';
  end if;
  if v_min is not null and v_min < 0 or v_max is not null and v_max < 0 then
    raise exception 'El stock minimo y el maximo no pueden ser negativos' using errcode = 'STU03';
  end if;
  if v_min is not null and v_max is not null and v_min > v_max then
    raise exception 'El stock minimo no puede ser mayor que el maximo' using errcode = 'STU04';
  end if;

  if v_min is null and v_max is null then
    delete from public.stock_umbral
    where id_producto = p_id_producto and id_deposito = p_id_deposito;
    return;
  end if;

  insert into public.stock_umbral (
    id_producto, id_deposito, stock_minimo, stock_maximo, creado_por
  ) values (
    p_id_producto, p_id_deposito, v_min, v_max, coalesce(p_creado_por, auth.uid())
  )
  on conflict (id_producto, id_deposito) do update
  set stock_minimo = excluded.stock_minimo,
      stock_maximo = excluded.stock_maximo,
      editado = now();
end;
$$;

create or replace function public.fn_stock_umbral_listar(p_id_producto uuid)
returns table (
  id_deposito uuid,
  nombre_deposito text,
  cantidad numeric,
  stock_minimo numeric,
  stock_maximo numeric
)
language sql
stable
set search_path to 'public'
as $$
  select
    d.id_deposito,
    d.nombre_deposito,
    coalesce(s.cantidad, 0),
    u.stock_minimo,
    u.stock_maximo
  from public.deposito d
  left join public.stock s
    on s.id_deposito = d.id_deposito and s.id_producto = p_id_producto
  left join public.stock_umbral u
    on u.id_deposito = d.id_deposito and u.id_producto = p_id_producto
  where d.activo
  order by d.nombre_deposito;
$$;

create or replace function public.fn_stock_alertas_listar(p_id_deposito uuid default null)
returns table (
  id_producto uuid,
  codigo_producto text,
  nombre_completo text,
  id_deposito uuid,
  nombre_deposito text,
  stock_actual numeric,
  stock_minimo numeric,
  stock_maximo numeric,
  diferencia numeric
)
language sql
stable
set search_path to 'public'
as $$
  select
    p.id_producto,
    p.codigo_producto::text,
    (p.nombre_producto || ' - ' || m.nombre_marca || ' (' || p.numero_medida || ' ' || um.abreviatura || ')')::text,
    d.id_deposito,
    d.nombre_deposito,
    coalesce(s.cantidad, 0),
    u.stock_minimo,
    u.stock_maximo,
    round(coalesce(s.cantidad, 0) - u.stock_minimo, 3)
  from public.stock_umbral u
  join public.producto p on p.id_producto = u.id_producto
  join public.marca m on m.id_marca = p.id_marca
  join public.unidad_medida um on um.id_unidad_medida = p.id_unidad_medida
  join public.deposito d on d.id_deposito = u.id_deposito
  left join public.stock s
    on s.id_producto = u.id_producto and s.id_deposito = u.id_deposito
  where u.stock_minimo is not null
    and coalesce(s.cantidad, 0) <= u.stock_minimo
    and (p_id_deposito is null or u.id_deposito = p_id_deposito)
  order by d.nombre_deposito, p.nombre_producto;
$$;

-- ---------------------------------------------------------------------
-- Orden de compra
-- ---------------------------------------------------------------------
create table if not exists public.orden_compra (
  id_orden_compra uuid primary key default gen_random_uuid(),
  numero          integer not null unique,
  id_proveedor    uuid not null references public.proveedor (id_proveedor),
  fecha_emision   date not null,
  estado          public.estado_orden_compra not null default 'Pendiente',
  observaciones   text,
  creado          timestamptz not null default now(),
  creado_por      uuid not null default auth.uid()
);

create table if not exists public.orden_compra_detalle (
  id_detalle           uuid primary key default gen_random_uuid(),
  id_orden_compra      uuid not null references public.orden_compra (id_orden_compra),
  id_producto          uuid not null references public.producto (id_producto),
  cantidad_solicitada  numeric(14,3) not null check (cantidad_solicitada > 0),
  cantidad_recibida    numeric(14,3) not null default 0 check (cantidad_recibida >= 0),
  precio_estimado      numeric(14,2) check (precio_estimado is null or precio_estimado >= 0),
  constraint orden_compra_detalle_producto_uq unique (id_orden_compra, id_producto),
  constraint orden_compra_detalle_recibida_check check (cantidad_recibida <= cantidad_solicitada)
);

alter table public.comprobante_proveedor
  add column if not exists id_orden_compra uuid references public.orden_compra (id_orden_compra);

create index if not exists orden_compra_proveedor_idx on public.orden_compra (id_proveedor);
create index if not exists comprobante_orden_compra_idx on public.comprobante_proveedor (id_orden_compra);

alter table public.orden_compra enable row level security;
alter table public.orden_compra_detalle enable row level security;
drop policy if exists orden_compra_all_authenticated on public.orden_compra;
drop policy if exists orden_compra_detalle_all_authenticated on public.orden_compra_detalle;
create policy orden_compra_all_authenticated on public.orden_compra for all to authenticated using (true) with check (true);
create policy orden_compra_detalle_all_authenticated on public.orden_compra_detalle for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.orden_compra, public.orden_compra_detalle to authenticated, service_role;

create or replace function public.fn_orden_compra_recalcular_estado(p_id_orden_compra uuid)
returns void
language plpgsql
set search_path to 'public'
as $$
declare
  v_estado public.estado_orden_compra;
  v_alguna_recibida boolean;
  v_alguna_pendiente boolean;
begin
  select estado into v_estado from public.orden_compra where id_orden_compra = p_id_orden_compra;
  if v_estado is null or v_estado = 'Cancelada' then
    return;
  end if;

  select
    coalesce(bool_or(cantidad_recibida > 0), false),
    coalesce(bool_or(cantidad_recibida < cantidad_solicitada), false)
  into v_alguna_recibida, v_alguna_pendiente
  from public.orden_compra_detalle
  where id_orden_compra = p_id_orden_compra;

  update public.orden_compra
  set estado = case
    when v_alguna_recibida and v_alguna_pendiente then 'Recibida parcial'
    when v_alguna_recibida and not v_alguna_pendiente then 'Recibida total'
    else 'Pendiente'
  end::public.estado_orden_compra
  where id_orden_compra = p_id_orden_compra;
end;
$$;

create or replace function public.fn_orden_compra_registrar(
  p_id_proveedor uuid,
  p_fecha_emision date,
  p_observaciones text,
  p_detalle jsonb,
  p_creado_por uuid default null
)
returns public.orden_compra
language plpgsql
set search_path to 'public'
as $$
declare
  v_orden   public.orden_compra;
  v_activo  boolean;
  v_numero  integer;
  v_dup     integer;
  v_malos   integer;
begin
  select activo into v_activo from public.proveedor where id_proveedor = p_id_proveedor;
  if v_activo is null then
    raise exception 'El proveedor indicado no existe' using errcode = 'OCO01';
  end if;
  if v_activo = false then
    raise exception 'El proveedor esta inactivo' using errcode = 'OCO02';
  end if;
  if p_fecha_emision is null then
    raise exception 'La fecha de emision es obligatoria' using errcode = 'OCO03';
  end if;
  if p_detalle is null or jsonb_typeof(p_detalle) <> 'array' or jsonb_array_length(p_detalle) = 0 then
    raise exception 'La orden tiene que tener al menos un articulo' using errcode = 'OCO04';
  end if;

  select count(*) into v_malos
  from jsonb_array_elements(p_detalle) e(value)
  where nullif(e.value->>'id_producto', '') is null
     or coalesce((e.value->>'cantidad')::numeric, 0) <= 0
     or (e.value->>'precio_estimado' is not null and e.value->>'precio_estimado' <> '' and (e.value->>'precio_estimado')::numeric < 0);
  if v_malos > 0 then
    raise exception 'Cada renglon necesita un articulo y una cantidad mayor a cero' using errcode = 'OCO04';
  end if;

  select count(*) into v_dup
  from (
    select nullif(e.value->>'id_producto', '') as id_producto
    from jsonb_array_elements(p_detalle) e(value)
    group by 1
    having count(*) > 1
  ) d;
  if v_dup > 0 then
    raise exception 'Un articulo no puede repetirse en la orden. Edita la cantidad del renglon' using errcode = 'OCO05';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_detalle) e(value)
    left join public.producto p on p.id_producto = nullif(e.value->>'id_producto', '')::uuid and p.activo
    where p.id_producto is null
  ) then
    raise exception 'Hay un articulo inexistente o inactivo' using errcode = 'OCO06';
  end if;

  perform pg_advisory_xact_lock(hashtext('orden_compra'));
  select coalesce(max(numero), 0) + 1 into v_numero from public.orden_compra;

  insert into public.orden_compra (numero, id_proveedor, fecha_emision, observaciones, creado_por)
  values (
    v_numero, p_id_proveedor, p_fecha_emision,
    nullif(btrim(p_observaciones), ''), coalesce(p_creado_por, auth.uid())
  )
  returning * into v_orden;

  insert into public.orden_compra_detalle (id_orden_compra, id_producto, cantidad_solicitada, precio_estimado)
  select
    v_orden.id_orden_compra,
    (e.value->>'id_producto')::uuid,
    round((e.value->>'cantidad')::numeric, 3),
    case when nullif(e.value->>'precio_estimado', '') is null then null
         else round((e.value->>'precio_estimado')::numeric, 2) end
  from jsonb_array_elements(p_detalle) e(value);

  return v_orden;
end;
$$;

create or replace function public.fn_orden_compra_listar(
  p_id_proveedor uuid default null,
  p_estado public.estado_orden_compra default null,
  p_desde date default null,
  p_hasta date default null
)
returns table (
  id_orden_compra uuid,
  numero integer,
  numero_formateado text,
  id_proveedor uuid,
  nombre_proveedor text,
  fecha_emision date,
  estado public.estado_orden_compra,
  cantidad_articulos bigint,
  creado timestamptz,
  creado_por_nombre text
)
language sql
stable
set search_path to 'public'
as $$
  select
    o.id_orden_compra,
    o.numero,
    'OC-' || lpad(o.numero::text, 6, '0'),
    o.id_proveedor,
    p.nombre_proveedor,
    o.fecha_emision,
    o.estado,
    (select count(*) from public.orden_compra_detalle d where d.id_orden_compra = o.id_orden_compra),
    o.creado,
    coalesce(u.nombre_completo, 'Usuario no disponible')
  from public.orden_compra o
  join public.proveedor p on p.id_proveedor = o.id_proveedor
  left join public.vw_usuario_resumen u on u.id_usuario = o.creado_por
  where (p_id_proveedor is null or o.id_proveedor = p_id_proveedor)
    and (p_estado is null or o.estado = p_estado)
    and (p_desde is null or o.fecha_emision >= p_desde)
    and (p_hasta is null or o.fecha_emision <= p_hasta)
  order by o.fecha_emision desc, o.numero desc;
$$;

create or replace function public.fn_orden_compra_obtener(p_id_orden_compra uuid)
returns jsonb
language sql
stable
set search_path to 'public'
as $$
  select jsonb_build_object(
    'orden', jsonb_build_object(
      'id_orden_compra', o.id_orden_compra,
      'numero', o.numero,
      'numero_formateado', 'OC-' || lpad(o.numero::text, 6, '0'),
      'id_proveedor', o.id_proveedor,
      'nombre_proveedor', p.nombre_proveedor,
      'fecha_emision', o.fecha_emision,
      'estado', o.estado,
      'observaciones', o.observaciones,
      'creado_por_nombre', coalesce(u.nombre_completo, 'Usuario no disponible')
    ),
    'detalle', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id_detalle', d.id_detalle,
        'id_producto', d.id_producto,
        'nombre_completo', pr.nombre_producto || ' - ' || m.nombre_marca || ' (' || pr.numero_medida || ' ' || um.abreviatura || ')',
        'cantidad_solicitada', d.cantidad_solicitada,
        'cantidad_recibida', d.cantidad_recibida,
        'precio_estimado', d.precio_estimado,
        'completo', d.cantidad_recibida >= d.cantidad_solicitada
      ) order by pr.nombre_producto)
      from public.orden_compra_detalle d
      join public.producto pr on pr.id_producto = d.id_producto
      join public.marca m on m.id_marca = pr.id_marca
      join public.unidad_medida um on um.id_unidad_medida = pr.id_unidad_medida
      where d.id_orden_compra = o.id_orden_compra
    ), '[]'::jsonb),
    'facturas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id_comprobante', c.id_comprobante,
        'numero_formateado', lpad(c.punto_venta::text, 5, '0') || '-' || lpad(c.numero::text, 8, '0'),
        'nombre_tipo_comprobante', tc.nombre_tipo_comprobante,
        'fecha_comprobante', c.fecha_comprobante,
        'importe_total', c.importe_total,
        'estado', c.estado,
        'anulado', c.anulado
      ) order by c.fecha_comprobante, c.creado)
      from public.comprobante_proveedor c
      join public.tipo_comprobante tc on tc.id_tipo_comprobante = c.id_tipo_comprobante
      where c.id_orden_compra = o.id_orden_compra
    ), '[]'::jsonb)
  )
  from public.orden_compra o
  join public.proveedor p on p.id_proveedor = o.id_proveedor
  left join public.vw_usuario_resumen u on u.id_usuario = o.creado_por
  where o.id_orden_compra = p_id_orden_compra;
$$;

create or replace function public.fn_orden_compra_cancelar(p_id_orden_compra uuid)
returns public.orden_compra
language plpgsql
set search_path to 'public'
as $$
declare
  v_orden public.orden_compra;
begin
  select * into v_orden from public.orden_compra where id_orden_compra = p_id_orden_compra for update;
  if v_orden.id_orden_compra is null then
    raise exception 'La orden de compra no existe' using errcode = 'OCO07';
  end if;
  if v_orden.estado <> 'Pendiente' then
    raise exception 'Solo se puede cancelar una orden pendiente, antes de recibir mercaderia' using errcode = 'OCO08';
  end if;
  if exists (
    select 1 from public.orden_compra_detalle
    where id_orden_compra = p_id_orden_compra and cantidad_recibida > 0
  ) or exists (
    select 1 from public.comprobante_proveedor
    where id_orden_compra = p_id_orden_compra and anulado = false
  ) then
    raise exception 'La orden ya tiene facturas o mercaderia recibida' using errcode = 'OCO08';
  end if;

  update public.orden_compra
  set estado = 'Cancelada'
  where id_orden_compra = p_id_orden_compra
  returning * into v_orden;
  return v_orden;
end;
$$;

-- Recepcion de lote: suma o resta cantidad_recibida de la orden vinculada.
create or replace function public.fn_orden_compra_sync_recepcion()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_id_orden  uuid;
  v_estado    public.estado_orden_compra;
  v_prod      uuid;
  v_cant      numeric;
  v_signo     integer;
  v_sol       numeric;
  v_rec       numeric;
  v_lote      uuid;
begin
  if tg_op = 'INSERT' then
    v_prod := new.id_producto;
    v_cant := new.cantidad_inventario;
    v_signo := 1;
    v_lote := new.id_inventario;
  else
    v_prod := old.id_producto;
    v_cant := old.cantidad_inventario;
    v_signo := -1;
    v_lote := old.id_inventario;
  end if;

  select c.id_orden_compra, o.estado
    into v_id_orden, v_estado
  from public.inventario i
  join public.comprobante_proveedor c on c.id_comprobante = i.id_comprobante
  left join public.orden_compra o on o.id_orden_compra = c.id_orden_compra
  where i.id_lote = v_lote;

  if v_id_orden is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' and v_estado = 'Cancelada' then
    raise exception 'La orden de compra esta cancelada y no admite recepcion' using errcode = 'OCO09';
  end if;

  select cantidad_solicitada, cantidad_recibida into v_sol, v_rec
  from public.orden_compra_detalle
  where id_orden_compra = v_id_orden and id_producto = v_prod
  for update;

  if v_sol is null then
    raise exception 'El producto recibido no esta en la orden de compra' using errcode = 'OCO11';
  end if;
  if round(v_rec + v_signo * v_cant, 3) > v_sol then
    raise exception 'La cantidad recibida supera la solicitada en la orden de compra' using errcode = 'OCO12';
  end if;
  if round(v_rec + v_signo * v_cant, 3) < 0 then
    raise exception 'La recepcion dejaria la cantidad recibida en negativo' using errcode = 'OCO12';
  end if;

  update public.orden_compra_detalle
  set cantidad_recibida = round(cantidad_recibida + v_signo * v_cant, 3)
  where id_orden_compra = v_id_orden and id_producto = v_prod;

  perform public.fn_orden_compra_recalcular_estado(v_id_orden);
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_orden_compra_sync_recepcion on public.inventario_producto;
create trigger trg_orden_compra_sync_recepcion
  before insert on public.inventario_producto
  for each row
  execute function public.fn_orden_compra_sync_recepcion();

-- La baja del lote borra el encabezado y recien ahi, en cascada, las lineas.
-- En esa cascada la linea ya no ve el encabezado, asi que la resta se hace
-- aca, mientras las lineas siguen existiendo.
create or replace function public.fn_orden_compra_sync_baja_lote()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_id_orden uuid;
  r record;
  v_rec numeric;
begin
  select id_orden_compra into v_id_orden
  from public.comprobante_proveedor
  where id_comprobante = old.id_comprobante;

  if v_id_orden is null then
    return old;
  end if;

  for r in
    select id_producto, cantidad_inventario
    from public.inventario_producto
    where id_inventario = old.id_lote
  loop
    select cantidad_recibida into v_rec
    from public.orden_compra_detalle
    where id_orden_compra = v_id_orden and id_producto = r.id_producto
    for update;

    if v_rec is null then
      continue;
    end if;
    if round(v_rec - r.cantidad_inventario, 3) < 0 then
      raise exception 'La baja del lote dejaria la cantidad recibida en negativo' using errcode = 'OCO12';
    end if;

    update public.orden_compra_detalle
    set cantidad_recibida = round(cantidad_recibida - r.cantidad_inventario, 3)
    where id_orden_compra = v_id_orden and id_producto = r.id_producto;
  end loop;

  perform public.fn_orden_compra_recalcular_estado(v_id_orden);
  return old;
end;
$$;

drop trigger if exists trg_orden_compra_sync_baja_lote on public.inventario;
create trigger trg_orden_compra_sync_baja_lote
  before delete on public.inventario
  for each row
  execute function public.fn_orden_compra_sync_baja_lote();

-- Factura de compra: exige orden y no factura de mas.
drop function if exists public.fn_comprobante_registrar(uuid, uuid, integer, integer, date, date, text, jsonb, uuid);

create function public.fn_comprobante_registrar(
  p_id_proveedor uuid,
  p_id_tipo_comprobante uuid,
  p_punto_venta integer,
  p_numero integer,
  p_fecha_comprobante date,
  p_fecha_vencimiento date,
  p_observaciones text,
  p_detalle jsonb,
  p_creado_por uuid,
  p_id_orden_compra uuid default null
)
returns public.comprobante_proveedor
language plpgsql
set search_path to 'public'
as $function$
declare
  v_comprobante     public.comprobante_proveedor;
  v_prov_activo     boolean;
  v_tipo            record;
  v_orden           public.orden_compra;
  v_invalidas       integer;
  v_subtotal        numeric;
  v_descuento_total numeric;
  v_impuesto_total  numeric;
  v_importe_total   numeric;
  r                 record;
  v_solicitada      numeric;
  v_ya              numeric;
begin
  select activo into v_prov_activo from public.proveedor where id_proveedor = p_id_proveedor;
  if v_prov_activo is null then
    raise exception 'El proveedor indicado no existe' using errcode = 'CMP01';
  end if;
  if v_prov_activo = false then
    raise exception 'El proveedor esta inactivo y no admite nuevos comprobantes' using errcode = 'CMP09';
  end if;

  select id_tipo_comprobante, aplica_compra, clase into v_tipo
  from public.tipo_comprobante where id_tipo_comprobante = p_id_tipo_comprobante;
  if v_tipo.id_tipo_comprobante is null then
    raise exception 'El tipo de comprobante indicado no existe' using errcode = 'CMP02';
  end if;
  if v_tipo.aplica_compra = false then
    raise exception 'El tipo de comprobante seleccionado no aplica a compras' using errcode = 'CMP02';
  end if;
  if v_tipo.clase <> 'factura' then
    raise exception 'El tipo de comprobante seleccionado no corresponde a una factura' using errcode = 'CMP02';
  end if;

  if p_id_orden_compra is null then
    raise exception 'La factura de compra tiene que vincularse a una orden de compra' using errcode = 'CMP11';
  end if;
  select * into v_orden from public.orden_compra where id_orden_compra = p_id_orden_compra for update;
  if v_orden.id_orden_compra is null then
    raise exception 'La orden de compra indicada no existe' using errcode = 'CMP11';
  end if;
  if v_orden.id_proveedor <> p_id_proveedor then
    raise exception 'La orden de compra es de otro proveedor' using errcode = 'CMP11';
  end if;
  if v_orden.estado = 'Cancelada' then
    raise exception 'La orden de compra esta cancelada y no admite facturas' using errcode = 'CMP11';
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

  for r in
    select (e.value->>'id_producto')::uuid as id_producto,
           round(sum((e.value->>'cantidad')::numeric), 3) as cantidad
    from jsonb_array_elements(p_detalle) e(value)
    where nullif(e.value->>'id_producto', '') is not null
    group by 1
  loop
    select cantidad_solicitada into v_solicitada
    from public.orden_compra_detalle
    where id_orden_compra = p_id_orden_compra and id_producto = r.id_producto;
    if v_solicitada is null then
      raise exception 'Hay un articulo de la factura que no esta en la orden de compra' using errcode = 'CMP12';
    end if;

    select coalesce(sum(d.cantidad), 0) into v_ya
    from public.comprobante_proveedor_detalle d
    join public.comprobante_proveedor c on c.id_comprobante = d.id_comprobante
    join public.tipo_comprobante tc on tc.id_tipo_comprobante = c.id_tipo_comprobante
    where c.id_orden_compra = p_id_orden_compra
      and c.anulado = false
      and tc.clase = 'factura'
      and d.id_producto = r.id_producto;

    if round(v_ya + r.cantidad, 3) > v_solicitada then
      raise exception 'La cantidad facturada supera la solicitada en la orden de compra' using errcode = 'CMP13';
    end if;
  end loop;

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
      observaciones, estado, creado_por, id_orden_compra
    ) values (
      p_id_proveedor, p_id_tipo_comprobante, p_punto_venta, p_numero,
      p_fecha_comprobante, p_fecha_vencimiento,
      v_subtotal, v_descuento_total, v_impuesto_total, v_importe_total, v_importe_total,
      nullif(btrim(p_observaciones), ''), 'Pendiente', coalesce(p_creado_por, auth.uid()),
      p_id_orden_compra
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

drop function if exists public.fn_comprobante_obtener(uuid);

create function public.fn_comprobante_obtener(p_id_comprobante uuid)
returns table(
  id_comprobante uuid, id_proveedor uuid, nombre_proveedor text,
  id_tipo_comprobante uuid, nombre_tipo_comprobante text, letra character,
  clase text,
  punto_venta integer, numero integer, numero_formateado text,
  fecha_comprobante date, fecha_vencimiento date,
  subtotal numeric, descuento_total numeric, impuesto_total numeric,
  importe_total numeric, saldo_pendiente numeric,
  observaciones text, anulado boolean, estado public.estado_comprobante_proveedor,
  creado timestamp with time zone, editado timestamp with time zone,
  creado_por uuid, creado_por_nombre text,
  total_detalle numeric,
  motivo text,
  id_comprobante_asociado uuid,
  numero_formateado_asociado text,
  nombre_tipo_comprobante_asociado text,
  id_orden_compra uuid,
  numero_orden text
)
language sql
stable
set search_path to 'public'
as $function$
  select
    c.id_comprobante, c.id_proveedor, p.nombre_proveedor,
    c.id_tipo_comprobante, tc.nombre_tipo_comprobante, tc.letra,
    tc.clase,
    c.punto_venta, c.numero,
    lpad(c.punto_venta::text, 5, '0') || '-' || lpad(c.numero::text, 8, '0') as numero_formateado,
    c.fecha_comprobante, c.fecha_vencimiento,
    c.subtotal, c.descuento_total, c.impuesto_total,
    c.importe_total, c.saldo_pendiente,
    c.observaciones, c.anulado, c.estado,
    c.creado, c.editado, c.creado_por,
    coalesce(ur.nombre_completo, 'Usuario no disponible') as creado_por_nombre,
    coalesce(d.total_detalle, 0) as total_detalle,
    ext.motivo,
    ext.id_comprobante_asociado,
    case when asoc.id_comprobante is not null then
      lpad(asoc.punto_venta::text, 5, '0') || '-' || lpad(asoc.numero::text, 8, '0')
    end as numero_formateado_asociado,
    tca.nombre_tipo_comprobante as nombre_tipo_comprobante_asociado,
    c.id_orden_compra,
    case when oc.id_orden_compra is not null then 'OC-' || lpad(oc.numero::text, 6, '0') end
  from public.comprobante_proveedor c
  join public.proveedor p on p.id_proveedor = c.id_proveedor
  join public.tipo_comprobante tc on tc.id_tipo_comprobante = c.id_tipo_comprobante
  left join public.vw_usuario_resumen ur on ur.id_usuario = c.creado_por
  left join public.orden_compra oc on oc.id_orden_compra = c.id_orden_compra
  left join lateral (
    select round(coalesce(sum(det.importe_linea), 0), 2) as total_detalle
    from public.comprobante_proveedor_detalle det
    where det.id_comprobante = c.id_comprobante
  ) d on true
  left join lateral (
    select nd.motivo, nd.id_comprobante_asociado
    from public.nota_debito_proveedor nd
    where tc.clase = 'nota_debito' and nd.id_comprobante = c.id_comprobante
    union all
    select nc.motivo, nc.id_comprobante_asociado
    from public.nota_credito_proveedor nc
    where tc.clase = 'nota_credito' and nc.id_comprobante = c.id_comprobante
    union all
    select null::text, rm.id_comprobante_asociado
    from public.remito_proveedor rm
    where tc.clase = 'remito' and rm.id_comprobante = c.id_comprobante
  ) ext on true
  left join public.comprobante_proveedor asoc on asoc.id_comprobante = ext.id_comprobante_asociado
  left join public.tipo_comprobante tca on tca.id_tipo_comprobante = asoc.id_tipo_comprobante
  where c.id_comprobante = p_id_comprobante;
$function$;

revoke execute on function public.fn_stock_umbral_guardar(uuid, uuid, numeric, numeric, uuid) from public, anon;
revoke execute on function public.fn_stock_umbral_listar(uuid) from public, anon;
revoke execute on function public.fn_stock_alertas_listar(uuid) from public, anon;
revoke execute on function public.fn_orden_compra_registrar(uuid, date, text, jsonb, uuid) from public, anon;
revoke execute on function public.fn_orden_compra_listar(uuid, public.estado_orden_compra, date, date) from public, anon;
revoke execute on function public.fn_orden_compra_obtener(uuid) from public, anon;
revoke execute on function public.fn_orden_compra_cancelar(uuid) from public, anon;
revoke execute on function public.fn_orden_compra_recalcular_estado(uuid) from public, anon;
revoke execute on function public.fn_comprobante_registrar(uuid, uuid, integer, integer, date, date, text, jsonb, uuid, uuid) from public, anon;
revoke execute on function public.fn_comprobante_obtener(uuid) from public, anon;

grant execute on function public.fn_stock_umbral_guardar(uuid, uuid, numeric, numeric, uuid) to authenticated, service_role;
grant execute on function public.fn_stock_umbral_listar(uuid) to authenticated, service_role;
grant execute on function public.fn_stock_alertas_listar(uuid) to authenticated, service_role;
grant execute on function public.fn_orden_compra_registrar(uuid, date, text, jsonb, uuid) to authenticated, service_role;
grant execute on function public.fn_orden_compra_listar(uuid, public.estado_orden_compra, date, date) to authenticated, service_role;
grant execute on function public.fn_orden_compra_obtener(uuid) to authenticated, service_role;
grant execute on function public.fn_orden_compra_cancelar(uuid) to authenticated, service_role;
grant execute on function public.fn_orden_compra_recalcular_estado(uuid) to authenticated, service_role;
grant execute on function public.fn_comprobante_registrar(uuid, uuid, integer, integer, date, date, text, jsonb, uuid, uuid) to authenticated, service_role;
grant execute on function public.fn_comprobante_obtener(uuid) to authenticated, service_role;
