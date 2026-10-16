-- S5-15b (AO-03, E-01): ofertas de la tienda online.
-- Una oferta es un precio fijo (menor al de la lista Minorista vigente) para un articulo durante un
-- rango de fechas. Tabla aparte de las listas de precios (resuelve la duda abierta de AO-03).
-- No hay ofertas superpuestas por articulo (exclusion constraint con btree_gist).
-- Escritura solo del personal del ERP (RLS es_personal_erp); la tienda las lee a traves de las
-- funciones SECURITY DEFINER fn_tienda_* (migracion siguiente).
-- Errcodes: OFE01 precio invalido, OFE02 fechas invalidas, OFE03 se superpone con otra oferta,
-- OFE04 precio no menor al de lista (o sin precio de lista vigente), OFE05 oferta inexistente,
-- PRD04 producto inexistente (ya existente).
-- Reversion: drop function fn_producto_oferta_*; drop function fn_producto_tienda_obtener; drop table producto_oferta.
create table if not exists public.producto_oferta (
  id_oferta uuid primary key default gen_random_uuid(),
  id_producto uuid not null references public.producto(id_producto) on delete cascade,
  precio_oferta numeric(14,2) not null check (precio_oferta > 0),
  fecha_inicio date not null default current_date,
  fecha_fin date,
  creado timestamptz not null default now(),
  creado_por uuid default auth.uid(),
  constraint producto_oferta_fechas_chk check (fecha_fin is null or fecha_fin >= fecha_inicio),
  constraint producto_oferta_sin_solape exclude using gist (
    id_producto with =,
    daterange(fecha_inicio, coalesce(fecha_fin, 'infinity'::date), '[]') with &&
  )
);

alter table public.producto_oferta enable row level security;
revoke all on public.producto_oferta from anon;

create policy producto_oferta_select_personal on public.producto_oferta
  for select to authenticated using (public.es_personal_erp());
create policy producto_oferta_insert_personal on public.producto_oferta
  for insert to authenticated with check (public.es_personal_erp());
create policy producto_oferta_update_personal on public.producto_oferta
  for update to authenticated using (public.es_personal_erp()) with check (public.es_personal_erp());
create policy producto_oferta_delete_personal on public.producto_oferta
  for delete to authenticated using (public.es_personal_erp());

create or replace function public.fn_producto_oferta_guardar(
  p_id_producto uuid,
  p_precio_oferta numeric,
  p_fecha_inicio date default current_date,
  p_fecha_fin date default null
)
returns public.producto_oferta
language plpgsql
set search_path = public
as $$
declare
  v_precio_lista numeric;
  v_oferta public.producto_oferta;
begin
  if not exists (select 1 from public.producto where id_producto = p_id_producto) then
    raise exception 'No se encontró el producto indicado' using errcode = 'PRD04';
  end if;
  if p_precio_oferta is null or p_precio_oferta <= 0 then
    raise exception 'El precio de oferta debe ser mayor a cero' using errcode = 'OFE01';
  end if;
  if p_fecha_inicio is null or (p_fecha_fin is not null and p_fecha_fin < p_fecha_inicio) then
    raise exception 'La fecha de fin no puede ser anterior a la de inicio' using errcode = 'OFE02';
  end if;

  select lpd.precio into v_precio_lista
  from public.lista_precio l
  join public.lista_precio_detalle lpd
    on lpd.id_lista_precio = l.id_lista_precio and lpd.id_producto = p_id_producto
  where l.tipo_lista = 'Minorista'
    and current_date between l.fecha_inicio and coalesce(l.fecha_fin, 'infinity'::date)
  limit 1;
  if v_precio_lista is null or p_precio_oferta >= v_precio_lista then
    raise exception 'El precio de oferta debe ser menor al precio de lista Minorista vigente'
      using errcode = 'OFE04';
  end if;

  begin
    insert into public.producto_oferta (id_producto, precio_oferta, fecha_inicio, fecha_fin)
    values (p_id_producto, p_precio_oferta, p_fecha_inicio, p_fecha_fin)
    returning * into v_oferta;
  exception when exclusion_violation then
    raise exception 'Ya hay una oferta de este artículo en esas fechas' using errcode = 'OFE03';
  end;

  return v_oferta;
end;
$$;

create or replace function public.fn_producto_oferta_eliminar(p_id_oferta uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  delete from public.producto_oferta where id_oferta = p_id_oferta;
  if not found then
    raise exception 'No se encontró la oferta indicada' using errcode = 'OFE05';
  end if;
end;
$$;

-- Datos de tienda de un articulo para el ERP: foto, precio de lista Minorista y ofertas vigentes/futuras.
create or replace function public.fn_producto_tienda_obtener(p_id_producto uuid)
returns table(imagen_url text, precio_lista numeric, ofertas jsonb)
language sql
stable
set search_path = public
as $$
  select
    p.imagen_url,
    (select lpd.precio
       from public.lista_precio l
       join public.lista_precio_detalle lpd
         on lpd.id_lista_precio = l.id_lista_precio and lpd.id_producto = p.id_producto
      where l.tipo_lista = 'Minorista'
        and current_date between l.fecha_inicio and coalesce(l.fecha_fin, 'infinity'::date)
      limit 1),
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'id_oferta', o.id_oferta, 'precio_oferta', o.precio_oferta,
               'fecha_inicio', o.fecha_inicio, 'fecha_fin', o.fecha_fin)
             order by o.fecha_inicio)
      from public.producto_oferta o
      where o.id_producto = p.id_producto
        and (o.fecha_fin is null or o.fecha_fin >= current_date)
    ), '[]'::jsonb)
  from public.producto p
  where p.id_producto = p_id_producto;
$$;

revoke all on function public.fn_producto_oferta_guardar(uuid, numeric, date, date) from public, anon;
revoke all on function public.fn_producto_oferta_eliminar(uuid) from public, anon;
revoke all on function public.fn_producto_tienda_obtener(uuid) from public, anon;
grant execute on function public.fn_producto_oferta_guardar(uuid, numeric, date, date) to authenticated;
grant execute on function public.fn_producto_oferta_eliminar(uuid) to authenticated;
grant execute on function public.fn_producto_tienda_obtener(uuid) to authenticated;
