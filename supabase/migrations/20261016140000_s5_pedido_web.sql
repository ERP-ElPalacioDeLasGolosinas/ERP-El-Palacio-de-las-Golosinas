-- S5-5a (E-03, D-027): pedido web propio. El comprobante_venta y el cobro se generan recien al
-- confirmar el pago (S5-6b); el stock se descuenta ahi, sin reserva mientras esta pendiente.
-- Aditiva: tablas y enum nuevos, ninguna funcion ni tabla existente se modifica.
-- Escritura solo via funciones SECURITY DEFINER (D-028); RLS exclusivo del personal (D-030).
-- Reversion: drop table pedido_web_detalle, pedido_web; drop type estado_pedido_web.

create type public.estado_pedido_web as enum
  ('Pendiente de pago', 'Pagado', 'En preparación', 'Despachado', 'Cancelado');

create table public.pedido_web (
  id_pedido      uuid primary key default gen_random_uuid(),
  numero         integer generated always as identity,
  id_cliente     uuid not null references public.cliente (id_cliente),
  id_medio_pago  uuid not null references public.medio_pago (id_medio_pago),
  estado         public.estado_pedido_web not null default 'Pendiente de pago',
  subtotal       numeric(14,2) not null check (subtotal >= 0),
  importe_total  numeric(14,2) not null check (importe_total >= 0),
  observaciones  text,
  id_comprobante uuid references public.comprobante_venta (id_comprobante),
  fecha_pago     timestamptz,
  creado         timestamptz not null default now(),
  editado        timestamptz not null default now(),
  creado_por     uuid default auth.uid(),
  constraint uq_pedido_web_numero unique (numero),
  constraint uq_pedido_web_comprobante unique (id_comprobante)
);

create table public.pedido_web_detalle (
  id_detalle      uuid primary key default gen_random_uuid(),
  id_pedido       uuid not null references public.pedido_web (id_pedido) on delete cascade,
  nro_linea       integer not null check (nro_linea > 0),
  id_producto     uuid not null references public.producto (id_producto),
  cantidad        numeric not null check (cantidad > 0),
  precio_unitario numeric(14,2) not null check (precio_unitario >= 0),
  importe_linea   numeric(14,2) generated always as (round(cantidad * precio_unitario, 2)) stored,
  constraint uq_pedido_web_detalle_linea unique (id_pedido, nro_linea)
);

create index ix_pedido_web_cliente_creado on public.pedido_web (id_cliente, creado desc);
create index ix_pedido_web_estado_creado on public.pedido_web (estado, creado desc);
create index ix_pedido_web_detalle_producto on public.pedido_web_detalle (id_producto);

create function public.set_editado_pedido_web() returns trigger
language plpgsql as $$
begin
  new.editado := now();
  return new;
end $$;

create trigger trg_set_editado_pedido_web
  before update on public.pedido_web
  for each row execute function public.set_editado_pedido_web();

alter table public.pedido_web enable row level security;
alter table public.pedido_web_detalle enable row level security;

create policy pedido_web_select_personal on public.pedido_web
  as permissive for select to authenticated using (public.es_personal_erp());
create policy pedido_web_insert_personal on public.pedido_web
  as permissive for insert to authenticated with check (public.es_personal_erp());
create policy pedido_web_update_personal on public.pedido_web
  as permissive for update to authenticated
  using (public.es_personal_erp()) with check (public.es_personal_erp());

create policy pedido_web_detalle_select_personal on public.pedido_web_detalle
  as permissive for select to authenticated using (public.es_personal_erp());
create policy pedido_web_detalle_insert_personal on public.pedido_web_detalle
  as permissive for insert to authenticated with check (public.es_personal_erp());
create policy pedido_web_detalle_update_personal on public.pedido_web_detalle
  as permissive for update to authenticated
  using (public.es_personal_erp()) with check (public.es_personal_erp());

-- anon no accede a tablas (D-028); el cliente web lee sus pedidos por funciones fn_*.
revoke all on public.pedido_web, public.pedido_web_detalle from anon;

comment on table public.pedido_web is
  'Pedido de la tienda online (E-03, D-027). Sin stock reservado; el stock sale al confirmar el pago.';
comment on column public.pedido_web.id_comprobante is
  'comprobante_venta generado al confirmar el pago (S5-6b). NULL mientras no se pago.';
comment on column public.pedido_web_detalle.precio_unitario is
  'Precio de la lista Minorista vigente al momento del pedido (snapshot).';
