-- El detalle de la nota de credito es el tipo de comprobante y no cambia.
-- Lo que queda para usar como medio de pago va en la columna restante.

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
    tc.nombre_tipo_comprobante,
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
    round(pg.importe_total - coalesce(pg.importe_saldo_favor, 0), 2),
    -round(pg.importe_total - coalesce(pg.importe_saldo_favor, 0), 2),
    'A favor',
    'pago'
  from public.pago pg
  where (p_id_proveedor is null or pg.id_proveedor = p_id_proveedor)
    and pg.importe_total > coalesce(pg.importe_saldo_favor, 0);
$$;

drop function if exists public.fn_cuenta_corriente_proveedor_movimientos(uuid, date, date);

create function public.fn_cuenta_corriente_proveedor_movimientos(
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
  saldo numeric,
  restante numeric
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
      ), 2) as saldo,
      case
        when l.tipo = 'Nota de crédito'
          then public.fn_nota_credito_disponible(l.id_documento, null)
        else null
      end as restante
    from public._fn_cc_proveedor_lineas(p_id_proveedor) l
  )
  select fecha, id_documento, tipo, numero, descripcion, importe, impacto, efecto, destino, saldo, restante
  from acum
  where (p_desde is null or fecha >= p_desde)
    and (p_hasta is null or fecha <= p_hasta)
  order by fecha, (impacto < 0), creado, id_documento;
$$;

revoke execute on function public.fn_cuenta_corriente_proveedor_movimientos(uuid, date, date) from public, anon;
grant execute on function public.fn_cuenta_corriente_proveedor_movimientos(uuid, date, date) to authenticated, service_role;

notify pgrst, 'reload schema';
