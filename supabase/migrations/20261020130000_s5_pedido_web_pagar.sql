-- S5-18f (D-034): fn_pedido_web_pagar(p_id_pedido, p_referencia). El cliente web confirma el pago de
-- SU pedido (tras aprobar la pasarela simulada). Valida que el pedido sea del cliente de auth.uid()
-- y delegue en fn_pedido_web_confirmar_pago_interno, que genera la venta, el stock y el cobro.
-- Es funcion nueva: no modifica ninguna existente.
-- Errcodes: PWB01 (sin cliente web activo), PWB05 (pedido inexistente, ajeno o no pendiente; viene de
-- la interna), PWB12 (referencia vacia, nuevo); PWB06/07/08 y COB0x se propagan de la interna.
-- Idempotente: si el pedido ya tiene comprobante devuelve el mismo resultado.
-- Reversion: drop function public.fn_pedido_web_pagar(uuid, text).

create or replace function public.fn_pedido_web_pagar(
  p_id_pedido uuid,
  p_referencia text
)
returns table(id_pedido uuid, id_comprobante uuid, numero_venta integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id_cliente uuid;
  v_ped_cliente uuid;
  v_res record;
  v_numero integer;
begin
  select c.id_cliente into v_id_cliente
  from public.cliente c
  where c.id_usuario = auth.uid() and c.activo = true;
  if v_id_cliente is null then
    raise exception 'No hay un cliente web activo para esta sesion' using errcode = 'PWB01';
  end if;

  select pw.id_cliente into v_ped_cliente
  from public.pedido_web pw where pw.id_pedido = p_id_pedido;
  if v_ped_cliente is null or v_ped_cliente <> v_id_cliente then
    raise exception 'El pedido indicado no existe' using errcode = 'PWB05';
  end if;

  if p_referencia is null or btrim(p_referencia) = '' then
    raise exception 'Falta la referencia del pago' using errcode = 'PWB12';
  end if;

  select r.id_pedido, r.id_comprobante into v_res
  from public.fn_pedido_web_confirmar_pago_interno(p_id_pedido, btrim(p_referencia)) r;

  select cv.numero into v_numero
  from public.comprobante_venta cv where cv.id_comprobante = v_res.id_comprobante;

  return query select v_res.id_pedido, v_res.id_comprobante, v_numero;
end;
$function$;

revoke all on function public.fn_pedido_web_pagar(uuid, text) from public, anon;
grant execute on function public.fn_pedido_web_pagar(uuid, text) to authenticated, service_role;
