-- Al vincular una factura, la orden pasa a Facturada y deja de ofrecerse.
-- Si despues se recibe mercaderia, el estado de recepcion tiene prioridad.
-- Si se anula la factura y no hubo recepcion, vuelve a Pendiente.

create or replace function public.fn_orden_compra_recalcular_estado(p_id_orden_compra uuid)
returns void
language plpgsql
set search_path to 'public'
as $$
declare
  v_estado public.estado_orden_compra;
  v_alguna_recibida boolean;
  v_alguna_pendiente boolean;
  v_facturada boolean;
begin
  select estado into v_estado from public.orden_compra where id_orden_compra = p_id_orden_compra;
  if v_estado is null or v_estado = 'Cancelada' then
    return;
  end if;

  select
    coalesce(bool_or(cantidad_recibida > 0), false),
    coalesce(bool_or(cantidad_recibida < cantidad_solicitada), false)
  into v_alguna_recibida, v_alguna_pendiente
  from public.orden_compra_detalle
  where id_orden_compra = p_id_orden_compra;

  select exists (
    select 1
    from public.comprobante_proveedor c
    join public.tipo_comprobante tc on tc.id_tipo_comprobante = c.id_tipo_comprobante
    where c.id_orden_compra = p_id_orden_compra
      and c.anulado = false
      and tc.clase = 'factura'
  ) into v_facturada;

  update public.orden_compra
  set estado = case
    when v_alguna_recibida and v_alguna_pendiente then 'Recibida parcial'
    when v_alguna_recibida and not v_alguna_pendiente then 'Recibida total'
    when v_facturada then 'Facturada'
    else 'Pendiente'
  end::public.estado_orden_compra
  where id_orden_compra = p_id_orden_compra;
end;
$$;

create or replace function public.fn_orden_compra_al_vincular_factura()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_clase text;
  v_estado public.estado_orden_compra;
  v_orden uuid;
begin
  if tg_op = 'DELETE' then
    v_orden := old.id_orden_compra;
  else
    v_orden := new.id_orden_compra;
  end if;

  if v_orden is null and tg_op = 'UPDATE' then
    v_orden := old.id_orden_compra;
  end if;
  if v_orden is null then
    return coalesce(new, old);
  end if;

  select clase into v_clase
  from public.tipo_comprobante
  where id_tipo_comprobante = case
    when tg_op = 'DELETE' then old.id_tipo_comprobante
    else new.id_tipo_comprobante
  end;

  if v_clase is distinct from 'factura' then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    select estado into v_estado
    from public.orden_compra
    where id_orden_compra = v_orden
    for update;

    if v_estado is distinct from 'Pendiente' then
      raise exception 'Solo se puede vincular una factura a una orden pendiente' using errcode = 'CMP14';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.fn_orden_compra_tras_vincular_factura()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_clase text;
  v_orden uuid;
begin
  v_orden := coalesce(new.id_orden_compra, old.id_orden_compra);
  if v_orden is null then
    return coalesce(new, old);
  end if;

  select clase into v_clase
  from public.tipo_comprobante
  where id_tipo_comprobante = coalesce(new.id_tipo_comprobante, old.id_tipo_comprobante);

  if v_clase = 'factura' then
    perform public.fn_orden_compra_recalcular_estado(v_orden);
  end if;

  if tg_op = 'UPDATE'
     and old.id_orden_compra is distinct from new.id_orden_compra
     and old.id_orden_compra is not null then
    perform public.fn_orden_compra_recalcular_estado(old.id_orden_compra);
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_orden_compra_antes_factura on public.comprobante_proveedor;
create trigger trg_orden_compra_antes_factura
  before insert on public.comprobante_proveedor
  for each row
  execute function public.fn_orden_compra_al_vincular_factura();

drop trigger if exists trg_orden_compra_tras_factura on public.comprobante_proveedor;
create trigger trg_orden_compra_tras_factura
  after insert or update of anulado, id_orden_compra on public.comprobante_proveedor
  for each row
  execute function public.fn_orden_compra_tras_vincular_factura();

do $$
declare
  r record;
begin
  for r in
    select id_orden_compra
    from public.orden_compra
    where estado <> 'Cancelada'
  loop
    perform public.fn_orden_compra_recalcular_estado(r.id_orden_compra);
  end loop;
end $$;
