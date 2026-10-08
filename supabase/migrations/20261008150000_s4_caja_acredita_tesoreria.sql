-- Venta de caja (minorista / consumidor final): Transferencia y Cheque de
-- terceros acreditan UNA cuenta de tesoreria vinculada al medio.
-- Una sola cuenta activa -> se elige sola. Varias -> el medio trae
-- id_cuenta_tesoreria. Ninguna -> CAJ15. Efectivo y Mercado Pago no tocan
-- cuentas. No se crea un cobro (sigue siendo el documento de Tesoreria).

alter table public.movimiento_tesoreria
  add column if not exists id_movimiento_caja uuid
  references public.movimiento_caja (id_movimiento_caja);

comment on column public.movimiento_tesoreria.id_movimiento_caja is
  'Ingreso generado por un cobro en caja (transferencia o cheque). Null en cobros y pagos de Tesoreria.';

create unique index if not exists movimiento_tesoreria_caja_idx
  on public.movimiento_tesoreria (id_movimiento_caja)
  where id_movimiento_caja is not null;

create or replace function public.fn_caja_registrar_cobro_venta(
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
  v_venta      public.comprobante_venta;
  v_caja       public.caja;
  v_motivo     text;
  v_suma       numeric;
  v_ref        text;
  v_id_mov     uuid;
  v_tipo_medio text;
  v_nombre     text;
  v_cant       integer;
  v_id_cuenta  uuid;
  v_saldo      numeric;
  r            record;
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
           e.value->>'referencia' as referencia,
           nullif(e.value->>'id_cuenta_tesoreria', '')::uuid as id_cuenta_tesoreria
    from jsonb_array_elements(p_medios) with ordinality as e(value, ord)
    order by e.ord
  loop
    v_ref := public._fn_caja_medio_validar(r.id_medio_pago, r.referencia);
    insert into public.movimiento_caja (id_caja, tipo, id_medio_pago, importe, motivo, referencia, id_comprobante, creado_por)
    values (v_caja.id_caja, 'Ingreso', r.id_medio_pago, r.importe, v_motivo, v_ref, v_venta.id_comprobante,
            coalesce(p_creado_por, auth.uid()))
    returning id_movimiento_caja into v_id_mov;

    select mp.tipo, mp.nombre_medio_pago into v_tipo_medio, v_nombre
    from public.medio_pago mp
    where mp.id_medio_pago = r.id_medio_pago;

    if v_tipo_medio in ('Transferencia', 'Cheque de terceros') then
      select count(*) into v_cant
      from public.medio_pago_cuenta mpc
      join public.cuenta_tesoreria ct
        on ct.id_cuenta = mpc.id_cuenta_tesoreria and ct.activo
      where mpc.id_medio_pago = r.id_medio_pago;

      v_id_cuenta := r.id_cuenta_tesoreria;

      if v_cant = 0 then
        raise exception 'El medio "%" no tiene una cuenta de tesoreria activa asignada', v_nombre
          using errcode = 'CAJ15';
      elsif v_id_cuenta is null and v_cant = 1 then
        select ct.id_cuenta into v_id_cuenta
        from public.medio_pago_cuenta mpc
        join public.cuenta_tesoreria ct
          on ct.id_cuenta = mpc.id_cuenta_tesoreria and ct.activo
        where mpc.id_medio_pago = r.id_medio_pago;
      elsif v_id_cuenta is null then
        raise exception 'El medio "%" esta asignado a mas de una cuenta de tesoreria. Elegi en cual acreditar', v_nombre
          using errcode = 'CAJ15';
      elsif not exists (
        select 1
        from public.medio_pago_cuenta mpc
        join public.cuenta_tesoreria ct
          on ct.id_cuenta = mpc.id_cuenta_tesoreria and ct.activo
        where mpc.id_medio_pago = r.id_medio_pago
          and mpc.id_cuenta_tesoreria = v_id_cuenta
      ) then
        raise exception 'La cuenta elegida no esta habilitada para el medio "%"', v_nombre
          using errcode = 'CAJ15';
      end if;

      select saldo_actual into v_saldo
      from public.cuenta_tesoreria
      where id_cuenta = v_id_cuenta
      for update;

      insert into public.movimiento_tesoreria (
        id_cuenta_tesoreria, tipo, importe, fecha, referencia, descripcion,
        id_movimiento_caja, saldo_anterior, saldo_nuevo, creado_por
      ) values (
        v_id_cuenta, 'Ingreso', r.importe, current_date, v_ref, v_motivo,
        v_id_mov, round(v_saldo, 2), round(v_saldo + r.importe, 2),
        coalesce(p_creado_por, auth.uid())
      );

      update public.cuenta_tesoreria
      set saldo_actual = round(saldo_actual + r.importe, 2)
      where id_cuenta = v_id_cuenta;
    end if;
  end loop;

  update public.comprobante_venta
  set estado = 'Pagado', saldo_pendiente = 0, id_caja = v_caja.id_caja
  where id_comprobante = v_venta.id_comprobante;

  return v_caja.id_caja;
end;
$$;

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
      'tipo_venta', v.tipo_venta,
      'id_caja', v.id_caja,
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
    ),
    'cobro_caja', (
      select jsonb_agg(jsonb_build_object(
        'id_movimiento_caja', mc.id_movimiento_caja,
        'nombre_medio_pago', mp.nombre_medio_pago,
        'tipo_medio', mp.tipo,
        'importe', mc.importe,
        'referencia', mc.referencia,
        'nombre_cuenta', ct.nombre_cuenta,
        'creado', mc.creado,
        'creado_por_nombre', coalesce(umc.nombre_completo, 'Usuario no disponible')
      ) order by mc.creado)
      from public.movimiento_caja mc
      join public.medio_pago mp on mp.id_medio_pago = mc.id_medio_pago
      left join public.vw_usuario_resumen umc on umc.id_usuario = mc.creado_por
      left join public.movimiento_tesoreria mt on mt.id_movimiento_caja = mc.id_movimiento_caja
      left join public.cuenta_tesoreria ct on ct.id_cuenta = mt.id_cuenta_tesoreria
      where mc.id_comprobante = v.id_comprobante
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
