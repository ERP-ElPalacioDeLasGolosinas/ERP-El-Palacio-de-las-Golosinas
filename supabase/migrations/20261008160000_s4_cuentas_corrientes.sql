-- T-06 / T-07 | Cuentas corrientes de clientes y proveedores.
-- El saldo se devenga de los comprobantes: no hay asientos manuales.
--
-- Proveedor (positivo = le debemos, negativo = saldo a nuestro favor):
--   factura y nota de debito suman; nota de credito y pago restan.
--   Anulados y remitos no entran.
-- Cliente (positivo = nos debe): venta mayorista suma, cobro resta.
--   Minorista, consumidor final y notas de venta no entran.
--
-- La nota de credito descuenta el saldo libre de la factura asociada
-- (saldo menos lo ya imputado en una orden abierta). El resto queda a favor
-- en la cuenta corriente. La suma de notas de una factura no puede superar
-- el total de esa factura.

alter table public.nota_credito_proveedor
  add column if not exists importe_aplicado numeric(14,2) not null default 0
  check (importe_aplicado >= 0);

comment on column public.nota_credito_proveedor.importe_aplicado is
  'Parte de la nota que bajo el saldo de la factura. El resto queda a favor en la cuenta corriente.';

create or replace function public.fn_nota_credito_aplicar_factura()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_nc        public.comprobante_proveedor;
  v_factura   public.comprobante_proveedor;
  v_otras     numeric;
  v_reservado numeric;
  v_libre     numeric;
  v_aplica    numeric;
begin
  select * into v_nc
  from public.comprobante_proveedor
  where id_comprobante = new.id_comprobante
  for update;

  select * into v_factura
  from public.comprobante_proveedor
  where id_comprobante = new.id_comprobante_asociado
  for update;

  if v_nc.id_comprobante is null or v_factura.id_comprobante is null or v_factura.anulado then
    raise exception 'La factura asociada indicada no existe' using errcode = 'NCR08';
  end if;

  select coalesce(sum(c.importe_total), 0) into v_otras
  from public.nota_credito_proveedor n
  join public.comprobante_proveedor c on c.id_comprobante = n.id_comprobante
  where n.id_comprobante_asociado = new.id_comprobante_asociado
    and n.id_comprobante <> new.id_comprobante
    and c.anulado = false;

  if round(v_otras + v_nc.importe_total, 2) > round(v_factura.importe_total, 2) then
    raise exception 'La suma de las notas de credito no puede superar el total de la factura'
      using errcode = 'NCR10';
  end if;

  select coalesce(sum(greatest(
    opc.importe_imputado - coalesce(pagado.importe, 0), 0
  )), 0) into v_reservado
  from public.orden_pago_comprobante opc
  join public.orden_pago op on op.id_orden_pago = opc.id_orden_pago
  left join lateral (
    select sum(pc.importe_aplicado) as importe
    from public.pago_comprobante pc
    join public.pago pg on pg.id_pago = pc.id_pago
    where pc.id_comprobante = opc.id_comprobante
      and pg.id_orden_pago = opc.id_orden_pago
  ) pagado on true
  where opc.id_comprobante = v_factura.id_comprobante
    and op.estado in ('Borrador', 'Pendiente de pago', 'Pagada parcial');

  v_libre := greatest(round(v_factura.saldo_pendiente - v_reservado, 2), 0);
  v_aplica := least(round(v_nc.importe_total, 2), v_libre);

  update public.nota_credito_proveedor
  set importe_aplicado = v_aplica
  where id_comprobante = new.id_comprobante;

  if v_aplica > 0 then
    update public.comprobante_proveedor
    set saldo_pendiente = round(saldo_pendiente - v_aplica, 2)
    where id_comprobante = v_factura.id_comprobante;

    perform public.fn_comprobante_recalcular_estado(v_factura.id_comprobante);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_nota_credito_aplicar_factura on public.nota_credito_proveedor;
create trigger trg_nota_credito_aplicar_factura
  after insert on public.nota_credito_proveedor
  for each row
  execute function public.fn_nota_credito_aplicar_factura();

create or replace function public.fn_comprobante_anular(p_id_comprobante uuid)
returns public.comprobante_proveedor
language plpgsql
set search_path to 'public'
as $function$
declare
  v_comprobante public.comprobante_proveedor;
  v_aplicado    numeric;
  v_factura     uuid;
begin
  if not exists (select 1 from public.comprobante_proveedor where id_comprobante = p_id_comprobante) then
    raise exception 'El comprobante indicado no existe' using errcode = 'CMP08';
  end if;

  select n.importe_aplicado, n.id_comprobante_asociado
    into v_aplicado, v_factura
  from public.nota_credito_proveedor n
  join public.comprobante_proveedor c on c.id_comprobante = n.id_comprobante
  join public.tipo_comprobante tc on tc.id_tipo_comprobante = c.id_tipo_comprobante
  where n.id_comprobante = p_id_comprobante
    and tc.clase = 'nota_credito'
    and c.anulado = false;

  if v_factura is not null and coalesce(v_aplicado, 0) > 0 then
    update public.comprobante_proveedor f
    set saldo_pendiente = least(f.importe_total, round(f.saldo_pendiente + v_aplicado, 2))
    where f.id_comprobante = v_factura
      and f.anulado = false;

    perform public.fn_comprobante_recalcular_estado(v_factura);
  end if;

  update public.comprobante_proveedor
  set anulado = true,
      estado  = 'Anulado'
  where id_comprobante = p_id_comprobante
  returning * into v_comprobante;

  return v_comprobante;
end;
$function$;

-- Lineas de la cuenta del proveedor. impacto > 0 aumenta lo que le debemos.
create or replace function public._fn_cc_proveedor_lineas(p_id_proveedor uuid)
returns table (
  id_proveedor uuid,
  fecha date,
  creado timestamptz,
  id_documento uuid,
  tipo text,
  numero text,
  descripcion text,
  importe numeric,
  impacto numeric,
  efecto text,
  destino text
)
language sql
stable
set search_path to 'public'
as $$
  select
    c.id_proveedor,
    c.fecha_comprobante,
    c.creado,
    c.id_comprobante,
    case tc.clase when 'factura' then 'Factura' else 'Nota de débito' end,
    lpad(c.punto_venta::text, 5, '0') || '-' || lpad(c.numero::text, 8, '0'),
    tc.nombre_tipo_comprobante,
    c.importe_total,
    c.importe_total,
    'En contra',
    'comprobante'
  from public.comprobante_proveedor c
  join public.tipo_comprobante tc on tc.id_tipo_comprobante = c.id_tipo_comprobante
  where c.anulado = false
    and tc.clase in ('factura', 'nota_debito')
    and (p_id_proveedor is null or c.id_proveedor = p_id_proveedor)

  union all

  select
    c.id_proveedor,
    c.fecha_comprobante,
    c.creado,
    c.id_comprobante,
    'Nota de crédito',
    lpad(c.punto_venta::text, 5, '0') || '-' || lpad(c.numero::text, 8, '0'),
    case
      when n.importe_aplicado <= 0 then 'Queda como saldo a favor'
      when n.importe_aplicado >= c.importe_total then 'Descuenta la factura asociada'
      else 'Descuenta parte de la factura; el resto queda a favor'
    end,
    c.importe_total,
    -c.importe_total,
    'A favor',
    'comprobante'
  from public.comprobante_proveedor c
  join public.tipo_comprobante tc on tc.id_tipo_comprobante = c.id_tipo_comprobante
  join public.nota_credito_proveedor n on n.id_comprobante = c.id_comprobante
  where c.anulado = false
    and tc.clase = 'nota_credito'
    and (p_id_proveedor is null or c.id_proveedor = p_id_proveedor)

  union all

  select
    pg.id_proveedor,
    pg.fecha_pago,
    pg.creado,
    pg.id_pago,
    'Pago',
    null,
    coalesce(nullif(btrim(pg.observaciones), ''), 'Pago'),
    pg.importe_total,
    -pg.importe_total,
    'A favor',
    'pago'
  from public.pago pg
  where p_id_proveedor is null or pg.id_proveedor = p_id_proveedor;
$$;

create or replace function public.fn_cuenta_corriente_proveedor_listar()
returns table (
  id_proveedor uuid,
  nombre_proveedor text,
  activo boolean,
  saldo numeric,
  cantidad_movimientos bigint
)
language sql
stable
set search_path to 'public'
as $$
  with lineas as (
    select * from public._fn_cc_proveedor_lineas(null)
  )
  select
    p.id_proveedor,
    p.nombre_proveedor,
    p.activo,
    coalesce(round(sum(l.impacto), 2), 0),
    count(l.id_documento)
  from public.proveedor p
  left join lineas l on l.id_proveedor = p.id_proveedor
  group by p.id_proveedor, p.nombre_proveedor, p.activo
  order by p.nombre_proveedor;
$$;

create or replace function public.fn_cuenta_corriente_proveedor_movimientos(
  p_id_proveedor uuid,
  p_desde date default null,
  p_hasta date default null
)
returns table (
  fecha date,
  id_documento uuid,
  tipo text,
  numero text,
  descripcion text,
  importe numeric,
  impacto numeric,
  efecto text,
  destino text,
  saldo numeric
)
language sql
stable
set search_path to 'public'
as $$
  with acum as (
    select
      l.fecha, l.id_documento, l.tipo, l.numero, l.descripcion,
      l.importe, l.impacto, l.efecto, l.destino, l.creado,
      round(sum(l.impacto) over (
        order by l.fecha, (l.impacto < 0), l.creado, l.id_documento
      ), 2) as saldo
    from public._fn_cc_proveedor_lineas(p_id_proveedor) l
  )
  select fecha, id_documento, tipo, numero, descripcion, importe, impacto, efecto, destino, saldo
  from acum
  where (p_desde is null or fecha >= p_desde)
    and (p_hasta is null or fecha <= p_hasta)
  order by fecha, (impacto < 0), creado, id_documento;
$$;

-- Lineas del cliente. impacto > 0 aumenta lo que nos debe.
create or replace function public._fn_cc_cliente_lineas(p_id_cliente uuid)
returns table (
  id_cliente uuid,
  fecha date,
  creado timestamptz,
  id_documento uuid,
  tipo text,
  numero text,
  descripcion text,
  importe numeric,
  impacto numeric,
  efecto text,
  destino text
)
language sql
stable
set search_path to 'public'
as $$
  select
    v.id_cliente,
    v.fecha_comprobante,
    v.creado,
    v.id_comprobante,
    'Venta',
    lpad(v.punto_venta::text, 5, '0') || '-' || lpad(v.numero::text, 8, '0'),
    tc.nombre_tipo_comprobante,
    v.importe_total,
    v.importe_total,
    'A favor',
    'venta'
  from public.comprobante_venta v
  join public.tipo_comprobante tc on tc.id_tipo_comprobante = v.id_tipo_comprobante
  where v.tipo_venta = 'Mayorista'
    and (p_id_cliente is null or v.id_cliente = p_id_cliente)

  union all

  select
    cb.id_cliente,
    cb.fecha_cobro,
    cb.creado,
    cb.id_cobro,
    'Cobro',
    lpad(v.punto_venta::text, 5, '0') || '-' || lpad(v.numero::text, 8, '0'),
    'Cobro de la venta',
    cb.importe_total,
    -cb.importe_total,
    'Cancela',
    'cobro'
  from public.cobro cb
  join public.comprobante_venta v on v.id_comprobante = cb.id_comprobante
  where v.tipo_venta = 'Mayorista'
    and (p_id_cliente is null or cb.id_cliente = p_id_cliente);
$$;

create or replace function public.fn_cuenta_corriente_cliente_listar()
returns table (
  id_cliente uuid,
  nombre_cliente text,
  activo boolean,
  saldo numeric,
  cantidad_movimientos bigint
)
language sql
stable
set search_path to 'public'
as $$
  with lineas as (
    select * from public._fn_cc_cliente_lineas(null)
  )
  select
    c.id_cliente,
    c.nombre_cliente,
    c.activo,
    coalesce(round(sum(l.impacto), 2), 0),
    count(l.id_documento)
  from public.cliente c
  left join lineas l on l.id_cliente = c.id_cliente
  where c.es_consumidor_final = false
  group by c.id_cliente, c.nombre_cliente, c.activo
  order by c.nombre_cliente;
$$;

create or replace function public.fn_cuenta_corriente_cliente_movimientos(
  p_id_cliente uuid,
  p_desde date default null,
  p_hasta date default null
)
returns table (
  fecha date,
  id_documento uuid,
  tipo text,
  numero text,
  descripcion text,
  importe numeric,
  impacto numeric,
  efecto text,
  destino text,
  saldo numeric
)
language sql
stable
set search_path to 'public'
as $$
  with acum as (
    select
      l.fecha, l.id_documento, l.tipo, l.numero, l.descripcion,
      l.importe, l.impacto, l.efecto, l.destino, l.creado,
      round(sum(l.impacto) over (
        order by l.fecha, (l.impacto < 0), l.creado, l.id_documento
      ), 2) as saldo
    from public._fn_cc_cliente_lineas(p_id_cliente) l
  )
  select fecha, id_documento, tipo, numero, descripcion, importe, impacto, efecto, destino, saldo
  from acum
  where (p_desde is null or fecha >= p_desde)
    and (p_hasta is null or fecha <= p_hasta)
  order by fecha, (impacto < 0), creado, id_documento;
$$;

revoke execute on function public._fn_cc_proveedor_lineas(uuid) from public, anon;
revoke execute on function public._fn_cc_cliente_lineas(uuid) from public, anon;
revoke execute on function public.fn_cuenta_corriente_proveedor_listar() from public, anon;
revoke execute on function public.fn_cuenta_corriente_proveedor_movimientos(uuid, date, date) from public, anon;
revoke execute on function public.fn_cuenta_corriente_cliente_listar() from public, anon;
revoke execute on function public.fn_cuenta_corriente_cliente_movimientos(uuid, date, date) from public, anon;
revoke execute on function public.fn_nota_credito_aplicar_factura() from public, anon;

grant execute on function public._fn_cc_proveedor_lineas(uuid) to authenticated, service_role;
grant execute on function public._fn_cc_cliente_lineas(uuid) to authenticated, service_role;
grant execute on function public.fn_cuenta_corriente_proveedor_listar() to authenticated, service_role;
grant execute on function public.fn_cuenta_corriente_proveedor_movimientos(uuid, date, date) to authenticated, service_role;
grant execute on function public.fn_cuenta_corriente_cliente_listar() to authenticated, service_role;
grant execute on function public.fn_cuenta_corriente_cliente_movimientos(uuid, date, date) to authenticated, service_role;
grant execute on function public.fn_nota_credito_aplicar_factura() to authenticated, service_role;
