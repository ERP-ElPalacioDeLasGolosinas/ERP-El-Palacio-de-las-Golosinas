-- S4-6 · V-21 · Venta con precio de lista y descuento % sobre el total.
-- comprobante_venta guarda la lista usada y el %; el descuento por línea queda sin uso.
-- fn_venta_registrar cambia de firma (sale el descuento por línea, entra p_descuento_porcentaje).

alter table public.comprobante_venta
  add column if not exists id_lista_precio uuid references public.lista_precio(id_lista_precio),
  add column if not exists descuento_porcentaje numeric(5,2) not null default 0;

alter table public.comprobante_venta
  add constraint chk_comprobante_venta_descuento_porcentaje
  check (descuento_porcentaje >= 0 and descuento_porcentaje <= 100);

drop function if exists public.fn_venta_registrar(uuid, uuid, date, text, jsonb, uuid);

create function public.fn_venta_registrar(
  p_id_cliente uuid,
  p_id_tipo_comprobante uuid,
  p_fecha_comprobante date,
  p_observaciones text,
  p_detalle jsonb,
  p_descuento_porcentaje numeric,
  p_creado_por uuid
) returns public.comprobante_venta
language plpgsql
set search_path to 'public'
as $function$
declare
  v_venta           public.comprobante_venta;
  v_cliente         record;
  v_tipo            record;
  v_lista           public.lista_precio;
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

  -- Lista vigente del tipo de cliente a la fecha del comprobante.
  select * into v_lista
  from public.fn_lista_precio_vigente(v_cliente.lista_precio, p_fecha_comprobante)
  limit 1;
  if v_lista.id_lista_precio is null then
    raise exception 'No hay una lista de precios % vigente al %', v_cliente.lista_precio, p_fecha_comprobante
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
    id_lista_precio, descuento_porcentaje,
    observaciones, estado, creado_por
  ) values (
    p_id_cliente, p_id_tipo_comprobante, 1, v_numero, p_fecha_comprobante,
    v_subtotal, v_descuento_total, v_importe_total, v_importe_total,
    v_lista.id_lista_precio, v_pct,
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

  return v_venta;
end;
$function$;

revoke execute on function public.fn_venta_registrar(uuid, uuid, date, text, jsonb, numeric, uuid) from public, anon;
grant execute on function public.fn_venta_registrar(uuid, uuid, date, text, jsonb, numeric, uuid)
  to authenticated, service_role;

-- fn_venta_obtener: suma la lista usada y el descuento %.
create or replace function public.fn_venta_obtener(p_id_comprobante uuid)
returns jsonb
language sql
stable
set search_path to 'public'
as $function$
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
      'descuento_porcentaje', v.descuento_porcentaje,
      'id_lista_precio', v.id_lista_precio,
      'nombre_lista_precio', lp.nombre_lista_precio,
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
        'creado_por_nombre', coalesce(uc.nombre_completo, 'Usuario no disponible'),
        'medios', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', cm.id,
            'nombre_medio_pago', mp.nombre_medio_pago,
            'nombre_cuenta', ct.nombre_cuenta,
            'referencia', cm.referencia,
            'importe', cm.importe
          ) order by mp.nombre_medio_pago)
          from public.cobro_medio cm
          join public.medio_pago mp on mp.id_medio_pago = cm.id_medio_pago
          join public.cuenta_tesoreria ct on ct.id_cuenta = cm.id_cuenta_tesoreria
          where cm.id_cobro = cb.id_cobro
        ), '[]'::jsonb)
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
  left join public.lista_precio lp on lp.id_lista_precio = v.id_lista_precio
  left join public.vw_usuario_resumen u on u.id_usuario = v.creado_por
  where v.id_comprobante = p_id_comprobante;
$function$;
