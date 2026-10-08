-- La nota de credito queda Confirmada al registrarse. No entra al
-- recálculo de pago (ese circuito la pasaría a Pagado o Pendiente).

update public.comprobante_proveedor c
set estado = 'Confirmada'
from public.tipo_comprobante tc
where tc.id_tipo_comprobante = c.id_tipo_comprobante
  and tc.clase = 'nota_credito'
  and c.anulado = false
  and c.estado is distinct from 'Confirmada';

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

  update public.comprobante_proveedor
  set estado = 'Confirmada'
  where id_comprobante = new.id_comprobante
    and anulado = false;

  return new;
end;
$$;

create or replace function public.fn_comprobante_recalcular_estado(p_id_comprobante uuid)
returns public.comprobante_proveedor
language plpgsql
set search_path to 'public'
as $function$
declare
  v_comprobante public.comprobante_proveedor;
  v_clase       text;
begin
  select * into v_comprobante
  from public.comprobante_proveedor
  where id_comprobante = p_id_comprobante;

  if v_comprobante.id_comprobante is null then
    raise exception 'El comprobante indicado no existe' using errcode = 'CMP08';
  end if;

  if v_comprobante.anulado then
    return v_comprobante;
  end if;

  select tc.clase into v_clase
  from public.tipo_comprobante tc
  where tc.id_tipo_comprobante = v_comprobante.id_tipo_comprobante;

  -- La nota de credito no se paga: queda confirmada.
  if v_clase = 'nota_credito' then
    update public.comprobante_proveedor
    set estado = 'Confirmada'
    where id_comprobante = p_id_comprobante
      and estado is distinct from 'Confirmada'
    returning * into v_comprobante;
    return v_comprobante;
  end if;

  update public.comprobante_proveedor
  set estado = case
    when saldo_pendiente <= 0 then 'Pagado'
    when exists (
      select 1
      from public.orden_pago_comprobante opc
      join public.orden_pago op on op.id_orden_pago = opc.id_orden_pago
      where opc.id_comprobante = p_id_comprobante
        and op.estado in ('Pendiente de pago', 'Pagada parcial')
    ) then 'En orden de pago'
    when saldo_pendiente < importe_total then 'Pagado parcial'
    else 'Pendiente'
  end::public.estado_comprobante_proveedor
  where id_comprobante = p_id_comprobante
  returning * into v_comprobante;

  return v_comprobante;
end;
$function$;
