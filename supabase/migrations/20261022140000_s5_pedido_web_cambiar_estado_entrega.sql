-- S5-19f (D-035): fn_pedido_web_cambiar_estado conoce la entrega.
-- Hoy: Pendiente de pago -> Pagado/Cancelado; Pagado -> En preparación; En preparación -> Despachado.
-- Cambia (misma firma, create or replace):
--   En preparación -> Despachado            solo si NO es retiro por sucursal (envío o pedidos previos, tipo_entrega NULL)
--   En preparación -> Listo para retirar    solo si es Retiro por sucursal
--   Listo para retirar -> Retirado
--   Al pasar a Despachado o Retirado la venta del pedido (comprobante_venta) pasa de "En preparación" a
--   "Despachado" con fecha_despacho = now(); si ya estaba Despachado/Pagado (pedidos previos a S5-19d) no se toca.
-- Sin cambios de esquema ni de grants. Errcodes: los mismos (PWB05, PWB09, PWB10).
-- Reversion: reaplicar el cuerpo de 20261016210000_s5_fn_pedido_web_obtener_cambiar_estado.sql.
create or replace function public.fn_pedido_web_cambiar_estado(
  p_id uuid,
  p_estado public.estado_pedido_web,
  p_referencia text default null
)
returns table(id_pedido uuid, numero integer, estado text, importe_total numeric, mail_cliente text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_ped public.pedido_web;
  v_retiro boolean;
begin
  if auth.uid() is null or not public.es_personal_erp() then
    raise exception 'Solo el personal del ERP puede cambiar el estado de un pedido' using errcode = 'PWB09';
  end if;

  select * into v_ped from public.pedido_web pw where pw.id_pedido = p_id for update;
  if v_ped.id_pedido is null then
    raise exception 'El pedido indicado no existe' using errcode = 'PWB05';
  end if;

  v_retiro := v_ped.tipo_entrega = 'Retiro por sucursal';

  if not (
       (v_ped.estado = 'Pendiente de pago'  and p_estado in ('Pagado', 'Cancelado'))
    or (v_ped.estado = 'Pagado'             and p_estado = 'En preparación')
    or (v_ped.estado = 'En preparación'     and p_estado = 'Despachado'         and not v_retiro)
    or (v_ped.estado = 'En preparación'     and p_estado = 'Listo para retirar' and v_retiro)
    or (v_ped.estado = 'Listo para retirar' and p_estado = 'Retirado')
  ) then
    raise exception 'El pedido esta "%" y no puede pasar a "%"', v_ped.estado, p_estado
      using errcode = 'PWB10';
  end if;

  if p_estado = 'Pagado' then
    perform public.fn_pedido_web_confirmar_pago(p_id, p_referencia);
  else
    update public.pedido_web pw set estado = p_estado where pw.id_pedido = p_id;
    if p_estado in ('Despachado', 'Retirado') and v_ped.id_comprobante is not null then
      update public.comprobante_venta cv
      set estado = 'Despachado', fecha_despacho = now()
      where cv.id_comprobante = v_ped.id_comprobante and cv.estado = 'En preparación';
    end if;
  end if;

  return query
    select pw.id_pedido, pw.numero, pw.estado::text, pw.importe_total, c.mail_cliente
    from public.pedido_web pw join public.cliente c on c.id_cliente = pw.id_cliente
    where pw.id_pedido = p_id;
end;
$function$;
