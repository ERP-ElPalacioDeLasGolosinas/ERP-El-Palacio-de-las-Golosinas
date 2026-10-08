-- Lo descontado de la factura asociada (importe_aplicado) no se puede
-- usar como medio de pago. Lo usado en un pago se descuenta aparte,
-- desde pago_nota_credito, y la cuenta del proveedor muestra el original
-- y lo que queda.
-- Los pagos ya registrados habian sumado ese uso dentro de importe_aplicado.
-- Se lo devuelve al descuento real de la factura.

update public.nota_credito_proveedor n
set importe_aplicado = greatest(
  round(n.importe_aplicado - coalesce(p.usado, 0), 2),
  0
)
from (
  select id_comprobante, sum(importe) as usado
  from public.pago_nota_credito
  group by id_comprobante
) p
where p.id_comprobante = n.id_comprobante
  and n.importe_aplicado > 0;

create or replace function public.fn_nota_credito_disponible(
  p_id_comprobante uuid,
  p_excluir_orden uuid default null
)
returns numeric
language sql
stable
set search_path to 'public'
as $$
  select greatest(0, round(
    c.importe_total
    - coalesce(n.importe_aplicado, 0)
    - coalesce((
        select sum(pn.importe)
        from public.pago_nota_credito pn
        where pn.id_comprobante = c.id_comprobante
      ), 0)
    - coalesce((
        select sum(greatest(r.importe - coalesce(pg.usado, 0), 0))
        from public.orden_pago_nota_credito r
        join public.orden_pago o on o.id_orden_pago = r.id_orden_pago
        left join lateral (
          select coalesce(sum(pn.importe), 0) as usado
          from public.pago_nota_credito pn
          join public.pago pg on pg.id_pago = pn.id_pago
          where pg.id_orden_pago = r.id_orden_pago
            and pn.id_comprobante = r.id_comprobante
        ) pg on true
        where r.id_comprobante = c.id_comprobante
          and o.estado in ('Borrador', 'Pendiente de pago', 'Pagada parcial')
          and (p_excluir_orden is null or o.id_orden_pago <> p_excluir_orden)
      ), 0)
  , 2))
  from public.comprobante_proveedor c
  join public.nota_credito_proveedor n on n.id_comprobante = c.id_comprobante
  join public.tipo_comprobante tc on tc.id_tipo_comprobante = c.id_tipo_comprobante
  where c.id_comprobante = p_id_comprobante
    and c.anulado = false
    and tc.clase = 'nota_credito';
$$;

drop function if exists public.fn_nota_credito_disponible_listar(uuid, uuid);

create function public.fn_nota_credito_disponible_listar(
  p_id_proveedor uuid,
  p_excluir_orden uuid default null
)
returns table (
  id_comprobante uuid,
  numero_formateado text,
  fecha_comprobante date,
  importe_total numeric,
  descontado numeric,
  usado numeric,
  disponible numeric
)
language sql
stable
set search_path to 'public'
as $$
  select
    c.id_comprobante,
    lpad(c.punto_venta::text, 5, '0') || '-' || lpad(c.numero::text, 8, '0'),
    c.fecha_comprobante,
    c.importe_total,
    coalesce(n.importe_aplicado, 0),
    coalesce((
      select sum(pn.importe)
      from public.pago_nota_credito pn
      where pn.id_comprobante = c.id_comprobante
    ), 0),
    public.fn_nota_credito_disponible(c.id_comprobante, p_excluir_orden)
  from public.comprobante_proveedor c
  join public.tipo_comprobante tc on tc.id_tipo_comprobante = c.id_tipo_comprobante
  join public.nota_credito_proveedor n on n.id_comprobante = c.id_comprobante
  where c.id_proveedor = p_id_proveedor
    and c.anulado = false
    and tc.clase = 'nota_credito'
    and public.fn_nota_credito_disponible(c.id_comprobante, p_excluir_orden) > 0
  order by c.fecha_comprobante, c.numero;
$$;

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

revoke execute on function public.fn_nota_credito_disponible_listar(uuid, uuid) from public, anon;
grant execute on function public.fn_nota_credito_disponible_listar(uuid, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
