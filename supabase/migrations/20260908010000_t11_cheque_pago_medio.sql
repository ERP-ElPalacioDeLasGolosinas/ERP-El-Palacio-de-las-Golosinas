-- =====================================================================
-- T-11 | Cheque minimo dentro del pago (P3 - opcional)
-- Sprint 2 - ERP El Palacio de las Golosinas
--
-- Depende de: T-08 (pago_medio), T-02 (medio_pago.tipo).
--
-- Guarda los datos de un cheque (numero, banco, cuenta, fechas, importe)
-- como parte del pago cuando el medio usado es de tipo cheque. Sin cartera
-- de valores ni estados avanzados (D-015).
--
-- Modelo:
--   - cheque   una fila por linea de pago_medio cuyo medio sea
--              'Cheque propio' o 'Cheque de terceros'.
--
-- Cambios en funciones:
--   - fn_pago_registrar  inserta la fila de cheque por cada pago_medio de
--                        tipo cheque; PAG06 si faltan numero o banco.
--   - fn_pago_obtener    agrega 'cheque' a cada medio del jsonb.
--
-- Codigo de error nuevo:
--   PAG06  medio de tipo cheque sin los datos minimos del cheque
--
-- Patron: RLS propia authenticated por tabla (D-010).
-- =====================================================================


-- ---------------------------------------------------------------------
-- Tabla cheque (colgada de pago_medio)
-- ---------------------------------------------------------------------
create table if not exists public.cheque (
  id_cheque     uuid primary key default gen_random_uuid(),

  id_pago_medio uuid not null
    references public.pago_medio (id) on delete cascade,

  numero        text not null,
  banco         text not null,
  cuenta        text,
  fecha_emision date,
  fecha_pago    date,
  importe       numeric(16,2) not null check (importe > 0),
  estado        text not null default 'Registrado',

  creado     timestamptz not null default now(),
  creado_por uuid not null default auth.uid(),

  constraint cheque_numero_no_vacio check (length(btrim(numero)) > 0),
  constraint cheque_banco_no_vacio check (length(btrim(banco)) > 0),
  constraint cheque_pago_medio_uq unique (id_pago_medio)
);

comment on table public.cheque is
  'T-11 | Datos de un cheque usado en un pago (D-015). Colgada de pago_medio, sin cartera de valores ni estados avanzados.';


-- ---------------------------------------------------------------------
-- Row Level Security - 4 politicas authenticated (D-010)
-- ---------------------------------------------------------------------
alter table public.cheque enable row level security;

drop policy if exists "cheque_select_authenticated" on public.cheque;
drop policy if exists "cheque_insert_authenticated" on public.cheque;
drop policy if exists "cheque_update_authenticated" on public.cheque;
drop policy if exists "cheque_delete_authenticated" on public.cheque;
create policy "cheque_select_authenticated"
  on public.cheque for select to authenticated using (true);
create policy "cheque_insert_authenticated"
  on public.cheque for insert to authenticated with check (true);
create policy "cheque_update_authenticated"
  on public.cheque for update to authenticated using (true) with check (true);
create policy "cheque_delete_authenticated"
  on public.cheque for delete to authenticated using (true);


-- ---------------------------------------------------------------------
-- fn_pago_registrar - ahora inserta la fila de cheque por cada medio
--   de tipo cheque. El unico cambio funcional es el paso 4 (insercion
--   de pago_medio, ahora fila por fila para capturar el id y colgar el
--   cheque) y la validacion PAG06.
-- ---------------------------------------------------------------------
create or replace function public.fn_pago_registrar(
  p_id_orden_pago uuid,
  p_fecha_pago date,
  p_medios jsonb,
  p_aplicaciones jsonb,
  p_confirmar_diferencia boolean,
  p_creado_por uuid
)
returns public.pago
language plpgsql
set search_path to 'public'
as $function$
declare
  v_orden          public.orden_pago;
  v_pago           public.pago;
  v_comp           public.comprobante_proveedor;
  v_activo         boolean;
  v_suma_medios    numeric(16,2);
  v_suma_aplicada  numeric(16,2);
  v_prov_nombre    text;
  v_saldo_ant      numeric(16,2);
  v_falta          boolean;
  v_id_pago_medio  uuid;
  v_tipo_medio     public.tipo_medio_pago;
  v_cheque         jsonb;
  r                record;
begin
  -- 1. orden pagable
  select * into v_orden from public.orden_pago where id_orden_pago = p_id_orden_pago;
  if v_orden.id_orden_pago is null then
    raise exception 'La orden de pago indicada no existe' using errcode = 'PAG01';
  end if;
  if v_orden.estado not in ('Pendiente de pago', 'Pagada parcial') then
    raise exception 'La orden no admite pagos en estado %', lower(v_orden.estado::text)
      using errcode = 'PAG01';
  end if;

  if p_aplicaciones is null
     or jsonb_typeof(p_aplicaciones) <> 'array'
     or jsonb_array_length(p_aplicaciones) = 0 then
    raise exception 'El pago debe aplicar al menos un comprobante' using errcode = 'PAG02';
  end if;
  if p_medios is null
     or jsonb_typeof(p_medios) <> 'array'
     or jsonb_array_length(p_medios) = 0 then
    raise exception 'El pago debe tener al menos un medio de pago' using errcode = 'PAG03';
  end if;

  if (
    select count(distinct (e.value->>'id_comprobante'))
    from jsonb_array_elements(p_aplicaciones) as e(value)
  ) <> jsonb_array_length(p_aplicaciones) then
    raise exception 'Hay comprobantes repetidos en el pago' using errcode = 'PAG02';
  end if;

  -- 2a. aplicaciones
  for r in
    select (e.value->>'id_comprobante')::uuid as id_comprobante,
           (e.value->>'importe_aplicado')::numeric as importe_aplicado
    from jsonb_array_elements(p_aplicaciones) as e(value)
  loop
    if not exists (
      select 1 from public.orden_pago_comprobante
      where id_orden_pago = p_id_orden_pago and id_comprobante = r.id_comprobante
    ) then
      raise exception 'Un comprobante del pago no pertenece a la orden' using errcode = 'PAG02';
    end if;
    if r.importe_aplicado is null or r.importe_aplicado <= 0 then
      raise exception 'El importe aplicado a cada comprobante debe ser mayor a cero' using errcode = 'PAG02';
    end if;

    select * into v_comp
    from public.comprobante_proveedor where id_comprobante = r.id_comprobante;
    if v_comp.id_comprobante is null or v_comp.anulado then
      raise exception 'Un comprobante del pago no existe o esta anulado' using errcode = 'PAG02';
    end if;
    if round(r.importe_aplicado, 2) > round(v_comp.saldo_pendiente, 2) then
      raise exception 'No se puede aplicar % a un comprobante con saldo %',
        to_char(round(r.importe_aplicado, 2), 'FM999999999990.00'),
        to_char(round(v_comp.saldo_pendiente, 2), 'FM999999999990.00')
        using errcode = 'PAG02';
    end if;
  end loop;

  -- 2b. medios
  for r in
    select (e.value->>'id_medio_pago')::uuid as id_medio_pago,
           (e.value->>'id_cuenta_tesoreria')::uuid as id_cuenta_tesoreria,
           (e.value->>'importe')::numeric as importe
    from jsonb_array_elements(p_medios) as e(value)
  loop
    if r.importe is null or r.importe <= 0 then
      raise exception 'El importe de cada medio de pago debe ser mayor a cero' using errcode = 'PAG03';
    end if;

    select activo into v_activo from public.medio_pago where id_medio_pago = r.id_medio_pago;
    if v_activo is null then
      raise exception 'Uno de los medios de pago no existe' using errcode = 'PAG04';
    end if;
    if v_activo = false then
      raise exception 'Uno de los medios de pago esta inactivo' using errcode = 'PAG04';
    end if;

    select activo into v_activo from public.cuenta_tesoreria where id_cuenta = r.id_cuenta_tesoreria;
    if v_activo is null then
      raise exception 'Una de las cuentas de tesoreria no existe' using errcode = 'PAG04';
    end if;
    if v_activo = false then
      raise exception 'Una de las cuentas de tesoreria esta inactiva' using errcode = 'PAG04';
    end if;

    if not exists (
      select 1 from public.medio_pago_cuenta
      where id_medio_pago = r.id_medio_pago
        and id_cuenta_tesoreria = r.id_cuenta_tesoreria
    ) then
      raise exception 'La cuenta elegida no esta habilitada para ese medio de pago' using errcode = 'PAG04';
    end if;
  end loop;

  select coalesce(sum((e.value->>'importe')::numeric), 0) into v_suma_medios
  from jsonb_array_elements(p_medios) as e(value);
  select coalesce(sum((e.value->>'importe_aplicado')::numeric), 0) into v_suma_aplicada
  from jsonb_array_elements(p_aplicaciones) as e(value);

  if round(v_suma_medios, 2) <> round(v_suma_aplicada, 2) then
    raise exception 'La suma de los medios (%) no coincide con lo aplicado (%)',
      to_char(round(v_suma_medios, 2), 'FM999999999990.00'),
      to_char(round(v_suma_aplicada, 2), 'FM999999999990.00')
      using errcode = 'PAG03';
  end if;

  -- 3. diferencia vs orden
  if round(v_suma_aplicada, 2) <> round(v_orden.importe_total, 2)
     and coalesce(p_confirmar_diferencia, false) = false then
    raise exception 'El total del pago (%) no coincide con el de la orden (%). Confirma la diferencia para continuar.',
      to_char(round(v_suma_aplicada, 2), 'FM999999999990.00'),
      to_char(round(v_orden.importe_total, 2), 'FM999999999990.00')
      using errcode = 'PAG05';
  end if;

  select nombre_proveedor into v_prov_nombre
  from public.proveedor where id_proveedor = v_orden.id_proveedor;

  -- 4. pago + detalle
  insert into public.pago (
    id_orden_pago, id_proveedor, fecha_pago, importe_total, creado_por
  ) values (
    p_id_orden_pago, v_orden.id_proveedor, coalesce(p_fecha_pago, current_date),
    round(v_suma_aplicada, 2), coalesce(p_creado_por, auth.uid())
  )
  returning * into v_pago;

  -- 4a. medios fila por fila (para colgar el cheque de tipo cheque)
  for r in
    select e.value as med
    from jsonb_array_elements(p_medios) as e(value)
  loop
    insert into public.pago_medio (id_pago, id_medio_pago, id_cuenta_tesoreria, importe, referencia)
    values (
      v_pago.id_pago,
      (r.med->>'id_medio_pago')::uuid,
      (r.med->>'id_cuenta_tesoreria')::uuid,
      round((r.med->>'importe')::numeric, 2),
      nullif(btrim(r.med->>'referencia'), '')
    )
    returning id into v_id_pago_medio;

    select tipo into v_tipo_medio
    from public.medio_pago where id_medio_pago = (r.med->>'id_medio_pago')::uuid;

    if v_tipo_medio in ('Cheque propio', 'Cheque de terceros') then
      v_cheque := r.med->'cheque';
      if v_cheque is null
         or jsonb_typeof(v_cheque) <> 'object'
         or coalesce(btrim(v_cheque->>'numero'), '') = ''
         or coalesce(btrim(v_cheque->>'banco'), '') = '' then
        raise exception 'El medio "%" requiere los datos del cheque (numero y banco)', v_tipo_medio
          using errcode = 'PAG06';
      end if;

      insert into public.cheque (
        id_pago_medio, numero, banco, cuenta, fecha_emision, fecha_pago, importe, creado_por
      ) values (
        v_id_pago_medio,
        btrim(v_cheque->>'numero'),
        btrim(v_cheque->>'banco'),
        nullif(btrim(v_cheque->>'cuenta'), ''),
        nullif(v_cheque->>'fecha_emision', '')::date,
        nullif(v_cheque->>'fecha_pago', '')::date,
        round(coalesce(nullif(v_cheque->>'importe', '')::numeric, (r.med->>'importe')::numeric), 2),
        coalesce(p_creado_por, auth.uid())
      );
    end if;
  end loop;

  insert into public.pago_comprobante (id_pago, id_comprobante, importe_aplicado)
  select v_pago.id_pago,
         (e.value->>'id_comprobante')::uuid,
         round((e.value->>'importe_aplicado')::numeric, 2)
  from jsonb_array_elements(p_aplicaciones) as e(value);

  -- 5. movimientos de tesoreria + saldo de cuentas
  for r in
    select pm.id_cuenta_tesoreria, pm.importe, pm.referencia
    from public.pago_medio pm
    where pm.id_pago = v_pago.id_pago
  loop
    select saldo_actual into v_saldo_ant
    from public.cuenta_tesoreria where id_cuenta = r.id_cuenta_tesoreria
    for update;

    insert into public.movimiento_tesoreria (
      id_cuenta_tesoreria, tipo, importe, fecha, referencia, descripcion,
      id_pago, saldo_anterior, saldo_nuevo, creado_por
    ) values (
      r.id_cuenta_tesoreria, 'Egreso', round(r.importe, 2), v_pago.fecha_pago,
      r.referencia, 'Pago a ' || coalesce(v_prov_nombre, 'proveedor'),
      v_pago.id_pago, round(v_saldo_ant, 2), round(v_saldo_ant - r.importe, 2),
      coalesce(p_creado_por, auth.uid())
    );

    update public.cuenta_tesoreria
    set saldo_actual = round(saldo_actual - r.importe, 2)
    where id_cuenta = r.id_cuenta_tesoreria;
  end loop;

  -- 6. baja de saldo de los comprobantes
  for r in
    select id_comprobante, importe_aplicado
    from public.pago_comprobante where id_pago = v_pago.id_pago
  loop
    update public.comprobante_proveedor
    set saldo_pendiente = round(saldo_pendiente - r.importe_aplicado, 2)
    where id_comprobante = r.id_comprobante;
  end loop;

  -- 7. estado de la orden
  select bool_or(cubierto = false) into v_falta
  from (
    select coalesce((
             select sum(pc.importe_aplicado)
             from public.pago_comprobante pc
             join public.pago pg on pg.id_pago = pc.id_pago
             where pg.id_orden_pago = p_id_orden_pago
               and pc.id_comprobante = opc.id_comprobante
           ), 0) >= round(opc.importe_imputado, 2) as cubierto
    from public.orden_pago_comprobante opc
    where opc.id_orden_pago = p_id_orden_pago
  ) t;

  update public.orden_pago
  set estado = case when coalesce(v_falta, true) then 'Pagada parcial' else 'Pagada' end
    ::public.estado_orden_pago
  where id_orden_pago = p_id_orden_pago;

  -- 8. estado de cada comprobante
  for r in
    select id_comprobante from public.pago_comprobante where id_pago = v_pago.id_pago
  loop
    perform public.fn_comprobante_recalcular_estado(r.id_comprobante);
  end loop;

  select * into v_pago from public.pago where id_pago = v_pago.id_pago;
  return v_pago;
end;
$function$;

comment on function public.fn_pago_registrar(uuid, date, jsonb, jsonb, boolean, uuid) is
  'T-08/T-11 | Registra un pago desde una orden: crea pago + medios + aplicaciones (+ cheque si el medio es de tipo cheque), genera movimiento_tesoreria (Egreso) bajando saldo_actual, baja saldo_pendiente de los comprobantes y recalcula estados de orden y comprobantes. Errcode PAG01..PAG06.';


-- ---------------------------------------------------------------------
-- fn_pago_obtener - agrega 'cheque' a cada medio del jsonb
-- ---------------------------------------------------------------------
create or replace function public.fn_pago_obtener(p_id_pago uuid)
returns jsonb
language sql
stable
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'pago', jsonb_build_object(
      'id_pago', pg.id_pago,
      'id_orden_pago', pg.id_orden_pago,
      'id_proveedor', pg.id_proveedor,
      'nombre_proveedor', p.nombre_proveedor,
      'fecha_pago', pg.fecha_pago,
      'importe_total', pg.importe_total,
      'observaciones', pg.observaciones,
      'estado_orden', o.estado,
      'creado', pg.creado,
      'editado', pg.editado,
      'creado_por', pg.creado_por,
      'creado_por_nombre', coalesce(ur.nombre_completo, 'Usuario no disponible')
    ),
    'medios', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pm.id,
        'id_medio_pago', pm.id_medio_pago,
        'nombre_medio_pago', mp.nombre_medio_pago,
        'tipo_medio_pago', mp.tipo,
        'id_cuenta_tesoreria', pm.id_cuenta_tesoreria,
        'nombre_cuenta', ct.nombre_cuenta,
        'tipo_cuenta', ct.tipo,
        'importe', pm.importe,
        'referencia', pm.referencia,
        'cheque', (
          select jsonb_build_object(
            'numero', ch.numero,
            'banco', ch.banco,
            'cuenta', ch.cuenta,
            'fecha_emision', ch.fecha_emision,
            'fecha_pago', ch.fecha_pago,
            'importe', ch.importe,
            'estado', ch.estado
          )
          from public.cheque ch
          where ch.id_pago_medio = pm.id
        )
      ) order by mp.nombre_medio_pago)
      from public.pago_medio pm
      join public.medio_pago mp on mp.id_medio_pago = pm.id_medio_pago
      join public.cuenta_tesoreria ct on ct.id_cuenta = pm.id_cuenta_tesoreria
      where pm.id_pago = pg.id_pago
    ), '[]'::jsonb),
    'aplicaciones', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pc.id,
        'id_comprobante', pc.id_comprobante,
        'numero_formateado',
          lpad(c.punto_venta::text, 5, '0') || '-' || lpad(c.numero::text, 8, '0'),
        'nombre_tipo_comprobante', tc.nombre_tipo_comprobante,
        'letra', tc.letra,
        'fecha_comprobante', c.fecha_comprobante,
        'fecha_vencimiento', c.fecha_vencimiento,
        'importe_total', c.importe_total,
        'saldo_pendiente', c.saldo_pendiente,
        'estado', c.estado,
        'importe_aplicado', pc.importe_aplicado
      ) order by c.fecha_comprobante, c.creado)
      from public.pago_comprobante pc
      join public.comprobante_proveedor c on c.id_comprobante = pc.id_comprobante
      join public.tipo_comprobante tc on tc.id_tipo_comprobante = c.id_tipo_comprobante
      where pc.id_pago = pg.id_pago
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
      where m.id_pago = pg.id_pago
    ), '[]'::jsonb)
  )
  from public.pago pg
  join public.proveedor p on p.id_proveedor = pg.id_proveedor
  join public.orden_pago o on o.id_orden_pago = pg.id_orden_pago
  left join public.vw_usuario_resumen ur on ur.id_usuario = pg.creado_por
  where pg.id_pago = p_id_pago;
$function$;

comment on function public.fn_pago_obtener(uuid) is
  'T-08/T-11 | Pago completo como jsonb: { pago, medios[] (cada uno con cheque|null), aplicaciones[], movimientos[] }. Devuelve null si no existe.';
