-- Una sucursal (depósito) puede tener varias cajas abiertas.
-- La venta minorista y a consumidor final sale solo del depósito de la caja elegida.
--
-- La caja ya abierta antes de esta migración queda con id_deposito null hasta que
-- se le asigne una vez con fn_caja_asignar_deposito.
--
-- CAJ01 deja de usarse: ya no hay tope de una caja abierta por punto de venta.
-- CAJ14 depósito inexistente, inactivo, o la caja ya tiene uno asignado.
-- VTA16 la venta de caja incluye artículos de otro depósito.

alter table public.caja
  add column id_deposito uuid references public.deposito (id_deposito);

create index caja_deposito_idx on public.caja (id_deposito);

drop index if exists public.caja_una_abierta_por_punto_venta;

-- El depósito se puede cargar una sola vez (cajas abiertas antes de pedirlo).
create or replace function public.fn_caja_proteger()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if old.estado = 'Cerrada' then
    raise exception 'La caja ya esta cerrada y no admite cambios' using errcode = 'CAJ04';
  end if;
  new.punto_venta    := old.punto_venta;
  new.id_deposito    := coalesce(old.id_deposito, new.id_deposito);
  new.monto_inicial  := old.monto_inicial;
  new.fecha_apertura := old.fecha_apertura;
  new.abierta_por    := old.abierta_por;
  new.editado        := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Abrir: pide depósito y no limita la cantidad de cajas abiertas
-- ---------------------------------------------------------------------------

drop function if exists public.fn_caja_abrir(numeric, text, uuid, integer);

create function public.fn_caja_abrir(
  p_monto_inicial numeric,
  p_observaciones text,
  p_creado_por uuid,
  p_id_deposito uuid
)
returns public.caja
language plpgsql
set search_path to 'public'
as $$
declare
  v_caja public.caja;
begin
  if p_monto_inicial is null or p_monto_inicial < 0 then
    raise exception 'El monto inicial en efectivo es obligatorio y no puede ser negativo' using errcode = 'CAJ02';
  end if;
  if p_id_deposito is null
     or not exists (select 1 from public.deposito where id_deposito = p_id_deposito and activo) then
    raise exception 'Elegi un deposito activo: la caja vende el stock de esa sucursal' using errcode = 'CAJ14';
  end if;

  insert into public.caja (punto_venta, id_deposito, monto_inicial, abierta_por, observaciones_apertura)
  values (1, p_id_deposito, round(p_monto_inicial, 2), coalesce(p_creado_por, auth.uid()), nullif(btrim(p_observaciones), ''))
  returning * into v_caja;

  return v_caja;
end;
$$;

create or replace function public.fn_caja_asignar_deposito(p_id_caja uuid, p_id_deposito uuid)
returns public.caja
language plpgsql
set search_path to 'public'
as $$
declare
  v_caja public.caja;
begin
  select * into v_caja from public.caja where id_caja = p_id_caja for update;
  if v_caja.id_caja is null then
    raise exception 'La caja indicada no existe' using errcode = 'CAJ03';
  end if;
  if v_caja.estado <> 'Abierta' then
    raise exception 'La caja esta cerrada' using errcode = 'CAJ04';
  end if;
  if v_caja.id_deposito is not null then
    raise exception 'La caja ya tiene un deposito asignado' using errcode = 'CAJ14';
  end if;
  if p_id_deposito is null
     or not exists (select 1 from public.deposito where id_deposito = p_id_deposito and activo) then
    raise exception 'Elegi un deposito activo: la caja vende el stock de esa sucursal' using errcode = 'CAJ14';
  end if;

  update public.caja
  set id_deposito = p_id_deposito
  where id_caja = p_id_caja
  returning * into v_caja;

  return v_caja;
end;
$$;

-- ---------------------------------------------------------------------------
-- Consultas: incluyen el depósito
-- ---------------------------------------------------------------------------

create or replace function public.fn_caja_obtener(p_id_caja uuid)
returns jsonb
language sql
stable
set search_path to 'public'
as $$
  select jsonb_build_object(
    'caja', jsonb_build_object(
      'id_caja', c.id_caja,
      'punto_venta', c.punto_venta,
      'id_deposito', c.id_deposito,
      'nombre_deposito', d.nombre_deposito,
      'estado', c.estado,
      'monto_inicial', c.monto_inicial,
      'fecha_apertura', c.fecha_apertura,
      'abierta_por', c.abierta_por,
      'abierta_por_nombre', coalesce(ua.nombre_completo, 'Usuario no disponible'),
      'observaciones_apertura', c.observaciones_apertura,
      'fecha_cierre', c.fecha_cierre,
      'cerrada_por', c.cerrada_por,
      'cerrada_por_nombre', uc.nombre_completo,
      'observaciones_cierre', c.observaciones_cierre,
      'total_ingresos', c.total_ingresos,
      'total_egresos', c.total_egresos,
      'saldo_teorico_efectivo', c.saldo_teorico_efectivo,
      'saldo_fisico_efectivo', c.saldo_fisico_efectivo,
      'diferencia_efectivo', c.diferencia_efectivo,
      'resumen_cierre', c.resumen_cierre
    ),
    'resumen', public.fn_caja_resumen(c.id_caja),
    'movimientos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id_movimiento_caja', m.id_movimiento_caja,
        'tipo', m.tipo,
        'id_medio_pago', m.id_medio_pago,
        'nombre_medio_pago', mp.nombre_medio_pago,
        'tipo_medio', mp.tipo,
        'importe', m.importe,
        'motivo', m.motivo,
        'referencia', m.referencia,
        'id_comprobante', m.id_comprobante,
        'comprobante', case when v.id_comprobante is null then null
          else tc.nombre_tipo_comprobante || ' ' || lpad(v.punto_venta::text, 5, '0') || '-' || lpad(v.numero::text, 8, '0') end,
        'creado', m.creado,
        'creado_por_nombre', coalesce(um.nombre_completo, 'Usuario no disponible')
      ) order by m.creado desc)
      from public.movimiento_caja m
      join public.medio_pago mp on mp.id_medio_pago = m.id_medio_pago
      left join public.comprobante_venta v on v.id_comprobante = m.id_comprobante
      left join public.tipo_comprobante tc on tc.id_tipo_comprobante = v.id_tipo_comprobante
      left join public.vw_usuario_resumen um on um.id_usuario = m.creado_por
      where m.id_caja = c.id_caja
    ), '[]'::jsonb),
    'arqueos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id_arqueo', a.id_arqueo,
        'saldo_teorico', a.saldo_teorico,
        'saldo_fisico', a.saldo_fisico,
        'diferencia', a.diferencia,
        'detalle_medios', a.detalle_medios,
        'observaciones', a.observaciones,
        'creado', a.creado,
        'creado_por_nombre', coalesce(uq.nombre_completo, 'Usuario no disponible')
      ) order by a.creado desc)
      from public.arqueo_caja a
      left join public.vw_usuario_resumen uq on uq.id_usuario = a.creado_por
      where a.id_caja = c.id_caja
    ), '[]'::jsonb)
  )
  from public.caja c
  left join public.deposito d on d.id_deposito = c.id_deposito
  left join public.vw_usuario_resumen ua on ua.id_usuario = c.abierta_por
  left join public.vw_usuario_resumen uc on uc.id_usuario = c.cerrada_por
  where c.id_caja = p_id_caja;
$$;

-- Si hay varias abiertas devuelve la más reciente, para no romper a quien todavía
-- llame esta función. El listado de abiertas es fn_caja_listar(p_estado => 'Abierta').
create or replace function public.fn_caja_obtener_abierta(p_punto_venta integer default 1)
returns jsonb
language sql
stable
set search_path to 'public'
as $$
  select public.fn_caja_obtener(c.id_caja)
  from public.caja c
  where c.estado = 'Abierta'
    and c.punto_venta = coalesce(p_punto_venta, 1)
  order by c.fecha_apertura desc
  limit 1;
$$;

drop function if exists public.fn_caja_listar(date, date, public.estado_caja);

create function public.fn_caja_listar(
  p_desde date default null,
  p_hasta date default null,
  p_estado public.estado_caja default null
)
returns table (
  id_caja uuid,
  punto_venta integer,
  id_deposito uuid,
  nombre_deposito text,
  estado public.estado_caja,
  monto_inicial numeric,
  fecha_apertura timestamptz,
  abierta_por_nombre text,
  fecha_cierre timestamptz,
  cerrada_por_nombre text,
  total_ingresos numeric,
  total_egresos numeric,
  saldo_teorico_efectivo numeric,
  saldo_fisico_efectivo numeric,
  diferencia_efectivo numeric,
  cantidad_movimientos bigint
)
language sql
stable
set search_path to 'public'
as $$
  select
    c.id_caja,
    c.punto_venta,
    c.id_deposito,
    d.nombre_deposito,
    c.estado,
    c.monto_inicial,
    c.fecha_apertura,
    coalesce(ua.nombre_completo, 'Usuario no disponible'),
    c.fecha_cierre,
    uc.nombre_completo,
    coalesce(c.total_ingresos, m.ingresos),
    coalesce(c.total_egresos, m.egresos),
    c.saldo_teorico_efectivo,
    c.saldo_fisico_efectivo,
    c.diferencia_efectivo,
    m.cantidad
  from public.caja c
  left join public.deposito d on d.id_deposito = c.id_deposito
  left join public.vw_usuario_resumen ua on ua.id_usuario = c.abierta_por
  left join public.vw_usuario_resumen uc on uc.id_usuario = c.cerrada_por
  cross join lateral (
    select coalesce(sum(case when mc.tipo = 'Ingreso' then mc.importe end), 0) as ingresos,
           coalesce(sum(case when mc.tipo = 'Egreso' then mc.importe end), 0) as egresos,
           count(mc.*) as cantidad
    from public.movimiento_caja mc
    where mc.id_caja = c.id_caja
  ) m
  where (p_desde is null or (c.fecha_apertura at time zone 'America/Argentina/Buenos_Aires')::date >= p_desde)
    and (p_hasta is null or (c.fecha_apertura at time zone 'America/Argentina/Buenos_Aires')::date <= p_hasta)
    and (p_estado is null or c.estado = p_estado)
  order by c.fecha_apertura desc;
$$;

-- ---------------------------------------------------------------------------
-- El cobro entra en la caja indicada, y las líneas tienen que ser de su depósito
-- ---------------------------------------------------------------------------

drop function if exists public.fn_venta_registrar(uuid, uuid, date, text, jsonb, numeric, uuid, public.tipo_venta, jsonb);
drop function if exists public.fn_caja_registrar_cobro_venta(uuid, jsonb, uuid);

create function public.fn_caja_registrar_cobro_venta(
  p_id_comprobante uuid,
  p_medios jsonb,
  p_creado_por uuid,
  p_id_caja uuid
)
returns uuid
language plpgsql
set search_path to 'public'
as $$
declare
  v_venta  public.comprobante_venta;
  v_caja   public.caja;
  v_motivo text;
  v_suma   numeric;
  v_ref    text;
  r        record;
begin
  select * into v_venta from public.comprobante_venta where id_comprobante = p_id_comprobante for update;
  if v_venta.id_comprobante is null then
    raise exception 'La venta indicada no existe' using errcode = 'VTA09';
  end if;
  if v_venta.tipo_venta = 'Mayorista' then
    raise exception 'Las ventas mayoristas se cobran en Tesoreria, no en caja' using errcode = 'CAJ10';
  end if;
  if v_venta.estado <> 'En preparación'
     or exists (select 1 from public.movimiento_caja where id_comprobante = p_id_comprobante) then
    raise exception 'La venta ya esta cobrada' using errcode = 'CAJ10';
  end if;

  if p_id_caja is null then
    raise exception 'Elegi la caja en la que se cobra la venta' using errcode = 'CAJ04';
  end if;
  select * into v_caja from public.caja where id_caja = p_id_caja for update;
  if v_caja.id_caja is null then
    raise exception 'La caja indicada no existe' using errcode = 'CAJ03';
  end if;
  if v_caja.estado <> 'Abierta' then
    raise exception 'La caja esta cerrada y no admite el cobro' using errcode = 'CAJ04';
  end if;
  if v_caja.id_deposito is null then
    raise exception 'La caja no tiene deposito asignado' using errcode = 'CAJ14';
  end if;
  if exists (
    select 1 from public.comprobante_venta_detalle d
    where d.id_comprobante = p_id_comprobante
      and d.id_deposito is distinct from v_caja.id_deposito
  ) then
    raise exception 'La venta de caja solo puede incluir articulos del deposito de la caja'
      using errcode = 'VTA16';
  end if;

  if p_medios is null or jsonb_typeof(p_medios) <> 'array' or jsonb_array_length(p_medios) = 0 then
    raise exception 'La venta debe cobrarse con al menos un medio de pago' using errcode = 'CAJ09';
  end if;

  for r in
    select (e.value->>'importe')::numeric as importe
    from jsonb_array_elements(p_medios) as e(value)
  loop
    if r.importe is null or r.importe <= 0 then
      raise exception 'El importe de cada medio de pago debe ser mayor a cero' using errcode = 'CAJ09';
    end if;
  end loop;

  select round(coalesce(sum((e.value->>'importe')::numeric), 0), 2) into v_suma
  from jsonb_array_elements(p_medios) as e(value);
  if v_suma <> round(v_venta.importe_total, 2) then
    raise exception 'La suma de los medios (%) tiene que ser igual al total de la venta (%)',
      to_char(v_suma, 'FM999999999990.00'), to_char(round(v_venta.importe_total, 2), 'FM999999999990.00')
      using errcode = 'CAJ09';
  end if;

  select 'Venta ' || tc.nombre_tipo_comprobante || ' '
         || lpad(v_venta.punto_venta::text, 5, '0') || '-' || lpad(v_venta.numero::text, 8, '0')
    into v_motivo
  from public.tipo_comprobante tc
  where tc.id_tipo_comprobante = v_venta.id_tipo_comprobante;

  for r in
    select (e.value->>'id_medio_pago')::uuid as id_medio_pago,
           round((e.value->>'importe')::numeric, 2) as importe,
           e.value->>'referencia' as referencia
    from jsonb_array_elements(p_medios) with ordinality as e(value, ord)
    order by e.ord
  loop
    v_ref := public._fn_caja_medio_validar(r.id_medio_pago, r.referencia);
    insert into public.movimiento_caja (id_caja, tipo, id_medio_pago, importe, motivo, referencia, id_comprobante, creado_por)
    values (v_caja.id_caja, 'Ingreso', r.id_medio_pago, r.importe, v_motivo, v_ref, v_venta.id_comprobante,
            coalesce(p_creado_por, auth.uid()));
  end loop;

  update public.comprobante_venta
  set estado = 'Pagado', saldo_pendiente = 0, id_caja = v_caja.id_caja
  where id_comprobante = v_venta.id_comprobante;

  return v_caja.id_caja;
end;
$$;

-- p_id_caja: caja abierta en la que se cobra la venta minorista o a consumidor final.
-- Las líneas tienen que salir del depósito de esa caja.

create function public.fn_venta_registrar(
  p_id_cliente uuid,
  p_id_tipo_comprobante uuid,
  p_fecha_comprobante date,
  p_observaciones text,
  p_detalle jsonb,
  p_descuento_porcentaje numeric,
  p_creado_por uuid,
  p_tipo_venta public.tipo_venta default 'Mayorista',
  p_medios jsonb default null,
  p_id_caja uuid default null
) returns public.comprobante_venta
language plpgsql
set search_path to 'public'
as $function$
declare
  v_tipo_venta      public.tipo_venta := coalesce(p_tipo_venta, 'Mayorista');
  v_tipo_lista      public.tipo_lista_precio;
  v_id_cliente      uuid := p_id_cliente;
  v_venta           public.comprobante_venta;
  v_cliente         record;
  v_tipo            record;
  v_lista           public.lista_precio;
  v_caja            public.caja;
  v_invalidas       integer;
  v_sin_precio      text;
  v_pct             numeric := coalesce(p_descuento_porcentaje, 0);
  v_subtotal        numeric;
  v_descuento_total numeric;
  v_importe_total   numeric;
  v_numero          integer;
  v_id_tipo_mov     uuid;
  v_remito          text;
  v_movimiento      public.movimiento_stock;
  r                 record;
begin
  v_tipo_lista := case when v_tipo_venta = 'Mayorista' then 'Mayorista' else 'Minorista' end;

  if v_tipo_venta = 'Consumidor final' and v_id_cliente is null then
    select id_cliente into v_id_cliente
    from public.cliente
    where es_consumidor_final and activo
    order by creado
    limit 1;
    if v_id_cliente is null then
      raise exception 'No existe el cliente generico "Consumidor final" activo' using errcode = 'VTA01';
    end if;
  end if;

  select c.id_cliente, c.activo, c.es_consumidor_final, tc.lista_precio
    into v_cliente
  from public.cliente c
  join public.tipo_cliente tc on tc.id_tipo_cliente = c.id_tipo_cliente
  where c.id_cliente = v_id_cliente;

  if v_cliente.id_cliente is null then
    raise exception 'El cliente indicado no existe' using errcode = 'VTA01';
  end if;
  if v_cliente.activo = false then
    raise exception 'El cliente esta inactivo y no admite nuevas ventas' using errcode = 'VTA01';
  end if;

  if v_tipo_venta = 'Mayorista' and (v_cliente.es_consumidor_final or v_cliente.lista_precio <> 'Mayorista') then
    raise exception 'Solo se pueden registrar ventas mayoristas a clientes mayoristas' using errcode = 'VTA02';
  end if;
  if v_tipo_venta = 'Minorista' and (v_cliente.es_consumidor_final or v_cliente.lista_precio <> 'Minorista') then
    raise exception 'La venta minorista requiere un cliente minorista registrado' using errcode = 'VTA02';
  end if;
  if v_tipo_venta = 'Consumidor final' and v_cliente.lista_precio <> 'Minorista' then
    raise exception 'Una venta a consumidor final admite el cliente generico o un cliente minorista' using errcode = 'VTA02';
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

  if v_tipo_venta = 'Mayorista' then
    if p_medios is not null and jsonb_typeof(p_medios) = 'array' and jsonb_array_length(p_medios) > 0 then
      raise exception 'La venta mayorista se cobra en Tesoreria una vez despachada' using errcode = 'VTA15';
    end if;
  else
    if p_fecha_comprobante <> current_date then
      raise exception 'Las ventas que se cobran en caja se registran con la fecha del dia' using errcode = 'VTA04';
    end if;
    if p_id_caja is null then
      raise exception 'Elegi la caja en la que se cobra la venta' using errcode = 'CAJ04';
    end if;
    select * into v_caja from public.caja where id_caja = p_id_caja;
    if v_caja.id_caja is null then
      raise exception 'La caja indicada no existe' using errcode = 'CAJ03';
    end if;
    if v_caja.estado <> 'Abierta' then
      raise exception 'La caja esta cerrada. Elegi una caja abierta' using errcode = 'CAJ04';
    end if;
    if v_caja.id_deposito is null then
      raise exception 'La caja no tiene deposito asignado' using errcode = 'CAJ14';
    end if;
    if p_medios is null or jsonb_typeof(p_medios) <> 'array' or jsonb_array_length(p_medios) = 0 then
      raise exception 'La venta debe cobrarse con al menos un medio de pago' using errcode = 'CAJ09';
    end if;
  end if;

  if p_detalle is null or jsonb_typeof(p_detalle) <> 'array' or jsonb_array_length(p_detalle) = 0 then
    raise exception 'La venta debe tener al menos un articulo' using errcode = 'VTA05';
  end if;

  if v_pct < 0 or v_pct > 100 then
    raise exception 'El descuento debe estar entre 0 y 100 por ciento' using errcode = 'VTA05';
  end if;

  select count(*) into v_invalidas
  from jsonb_array_elements(p_detalle) as e(value)
  where nullif(e.value->>'id_producto', '') is null
     or nullif(e.value->>'id_deposito', '') is null
     or coalesce((e.value->>'cantidad')::numeric, 0) <= 0;
  if v_invalidas > 0 then
    raise exception 'Hay lineas invalidas: cada linea necesita articulo, deposito y cantidad mayor a cero' using errcode = 'VTA05';
  end if;

  if v_tipo_venta <> 'Mayorista' and exists (
    select 1 from jsonb_array_elements(p_detalle) as e(value)
    where (e.value->>'id_deposito')::uuid is distinct from v_caja.id_deposito
  ) then
    raise exception 'La venta de caja solo puede incluir articulos de %',
      (select nombre_deposito from public.deposito where id_deposito = v_caja.id_deposito)
      using errcode = 'VTA16';
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

  select * into v_lista
  from public.fn_lista_precio_vigente(v_tipo_lista, p_fecha_comprobante)
  limit 1;
  if v_lista.id_lista_precio is null then
    raise exception 'No hay una lista de precios % vigente al %', v_tipo_lista, p_fecha_comprobante
      using errcode = 'VTA13';
  end if;

  select string_agg(distinct p.nombre_producto, ', ') into v_sin_precio
  from jsonb_array_elements(p_detalle) as e(value)
  join public.producto p on p.id_producto = (e.value->>'id_producto')::uuid
  left join public.lista_precio_detalle lpd
    on lpd.id_lista_precio = v_lista.id_lista_precio and lpd.id_producto = p.id_producto
  where lpd.precio is null;
  if v_sin_precio is not null then
    raise exception 'Sin precio en la lista "%" para: %', v_lista.nombre_lista_precio, v_sin_precio
      using errcode = 'VTA14';
  end if;

  select round(coalesce(sum((e.value->>'cantidad')::numeric * lpd.precio), 0), 2)
    into v_subtotal
  from jsonb_array_elements(p_detalle) as e(value)
  join public.lista_precio_detalle lpd
    on lpd.id_lista_precio = v_lista.id_lista_precio
   and lpd.id_producto = (e.value->>'id_producto')::uuid;

  v_descuento_total := round(v_subtotal * v_pct / 100, 2);
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
    id_lista_precio, descuento_porcentaje, tipo_venta,
    observaciones, estado, creado_por
  ) values (
    v_id_cliente, p_id_tipo_comprobante, 1, v_numero, p_fecha_comprobante,
    v_subtotal, v_descuento_total, v_importe_total, v_importe_total,
    v_lista.id_lista_precio, v_pct, v_tipo_venta,
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
    lpd.precio,
    0
  from jsonb_array_elements(p_detalle) with ordinality as e(value, ord)
  join public.lista_precio_detalle lpd
    on lpd.id_lista_precio = v_lista.id_lista_precio
   and lpd.id_producto = (e.value->>'id_producto')::uuid;

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

  if v_tipo_venta <> 'Mayorista' then
    perform public.fn_caja_registrar_cobro_venta(
      v_venta.id_comprobante, p_medios, coalesce(p_creado_por, auth.uid()), p_id_caja
    );
    select * into v_venta from public.comprobante_venta where id_comprobante = v_venta.id_comprobante;
  end if;

  return v_venta;
end;
$function$;

revoke execute on function public.fn_caja_abrir(numeric, text, uuid, uuid) from public, anon;
revoke execute on function public.fn_caja_asignar_deposito(uuid, uuid) from public, anon;
revoke execute on function public.fn_caja_listar(date, date, public.estado_caja) from public, anon;
revoke execute on function public.fn_caja_registrar_cobro_venta(uuid, jsonb, uuid, uuid) from public, anon;
revoke execute on function public.fn_venta_registrar(uuid, uuid, date, text, jsonb, numeric, uuid, public.tipo_venta, jsonb, uuid) from public, anon;

grant execute on function public.fn_caja_abrir(numeric, text, uuid, uuid) to authenticated, service_role;
grant execute on function public.fn_caja_asignar_deposito(uuid, uuid) to authenticated, service_role;
grant execute on function public.fn_caja_listar(date, date, public.estado_caja) to authenticated, service_role;
grant execute on function public.fn_caja_registrar_cobro_venta(uuid, jsonb, uuid, uuid) to authenticated, service_role;
grant execute on function public.fn_venta_registrar(uuid, uuid, date, text, jsonb, numeric, uuid, public.tipo_venta, jsonb, uuid) to authenticated, service_role;
