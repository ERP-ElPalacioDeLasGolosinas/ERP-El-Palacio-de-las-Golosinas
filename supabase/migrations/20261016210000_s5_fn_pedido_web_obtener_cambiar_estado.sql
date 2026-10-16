-- S5-9b (AO-04): detalle del pedido web y cambio de estado para el personal del ERP.
--  * fn_pedido_web_obtener(p_id): cabecera + cliente + lineas (jsonb). SECURITY INVOKER: filtra la
--    RLS de pedido_web / cliente (solo personal, D-030). Sin filas si no existe.
--  * fn_pedido_web_cambiar_estado(p_id, p_estado, p_referencia): transiciones validas
--      Pendiente de pago -> Pagado           (delega en fn_pedido_web_confirmar_pago, S5-6b: genera
--                                             comprobante, descuenta stock y registra el cobro;
--                                             p_referencia es la del movimiento bancario)
--      Pendiente de pago -> Cancelado        (todavia sin stock ni cobro, D-027)
--      Pagado            -> En preparación
--      En preparación    -> Despachado
--    Un pedido ya pagado NO se cancela aca: tiene stock descontado y cobro registrado y revertirlos
--    es otro circuito. Devuelve los datos que necesita el aviso por mail (mail_cliente, importe_total).
-- Errcodes: PWB05 (pedido inexistente, de confirmar_pago), PWB09 (solo personal del ERP),
-- PWB10 (transicion no permitida). PWB06/07/08 y COB0x se propagan desde fn_pedido_web_confirmar_pago.
-- Aditiva: funciones nuevas, ninguna existente se modifica.
-- Reversion: drop function public.fn_pedido_web_obtener(uuid);
--            drop function public.fn_pedido_web_cambiar_estado(uuid, public.estado_pedido_web, text).
create or replace function public.fn_pedido_web_obtener(p_id uuid)
returns table(
  id_pedido uuid,
  numero integer,
  estado text,
  subtotal numeric,
  importe_total numeric,
  observaciones text,
  creado timestamptz,
  fecha_pago timestamptz,
  id_comprobante uuid,
  medio_pago text,
  id_cliente uuid,
  nombre_cliente text,
  documento_cliente text,
  telefono_cliente text,
  mail_cliente text,
  direccion_cliente text,
  lineas jsonb
)
language sql
stable
set search_path to 'public'
as $function$
  select pw.id_pedido, pw.numero, pw.estado::text, pw.subtotal, pw.importe_total, pw.observaciones,
         pw.creado, pw.fecha_pago, pw.id_comprobante, mp.nombre_medio_pago,
         c.id_cliente, c.nombre_cliente, c.documento_cliente, c.telefono_cliente, c.mail_cliente,
         c.direccion_cliente,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'nro_linea', d.nro_linea,
                    'id_producto', d.id_producto,
                    'codigo_producto', p.codigo_producto,
                    'nombre_producto', p.nombre_producto,
                    'nombre_marca', m.nombre_marca,
                    'presentacion', p.numero_medida || ' ' || um.abreviatura,
                    'cantidad', d.cantidad,
                    'precio_unitario', d.precio_unitario,
                    'importe_linea', d.importe_linea) order by d.nro_linea)
           from public.pedido_web_detalle d
           join public.producto p on p.id_producto = d.id_producto
           left join public.marca m on m.id_marca = p.id_marca
           left join public.unidad_medida um on um.id_unidad_medida = p.id_unidad_medida
           where d.id_pedido = pw.id_pedido
         ), '[]'::jsonb)
  from public.pedido_web pw
  join public.cliente c on c.id_cliente = pw.id_cliente
  join public.medio_pago mp on mp.id_medio_pago = pw.id_medio_pago
  where pw.id_pedido = p_id;
$function$;

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
begin
  if auth.uid() is null or not public.es_personal_erp() then
    raise exception 'Solo el personal del ERP puede cambiar el estado de un pedido' using errcode = 'PWB09';
  end if;

  select * into v_ped from public.pedido_web pw where pw.id_pedido = p_id for update;
  if v_ped.id_pedido is null then
    raise exception 'El pedido indicado no existe' using errcode = 'PWB05';
  end if;

  if not (
       (v_ped.estado = 'Pendiente de pago' and p_estado in ('Pagado', 'Cancelado'))
    or (v_ped.estado = 'Pagado'            and p_estado = 'En preparación')
    or (v_ped.estado = 'En preparación'    and p_estado = 'Despachado')
  ) then
    raise exception 'El pedido esta "%" y no puede pasar a "%"', v_ped.estado, p_estado
      using errcode = 'PWB10';
  end if;

  if p_estado = 'Pagado' then
    perform public.fn_pedido_web_confirmar_pago(p_id, p_referencia);
  else
    update public.pedido_web pw set estado = p_estado where pw.id_pedido = p_id;
  end if;

  return query
    select pw.id_pedido, pw.numero, pw.estado::text, pw.importe_total, c.mail_cliente
    from public.pedido_web pw join public.cliente c on c.id_cliente = pw.id_cliente
    where pw.id_pedido = p_id;
end;
$function$;

revoke all on function public.fn_pedido_web_obtener(uuid) from public, anon;
grant execute on function public.fn_pedido_web_obtener(uuid) to authenticated, service_role;
revoke all on function public.fn_pedido_web_cambiar_estado(uuid, public.estado_pedido_web, text) from public, anon;
grant execute on function public.fn_pedido_web_cambiar_estado(uuid, public.estado_pedido_web, text) to authenticated, service_role;
