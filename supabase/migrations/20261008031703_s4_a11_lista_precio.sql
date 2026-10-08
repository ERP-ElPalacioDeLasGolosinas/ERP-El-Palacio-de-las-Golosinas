-- S4-2 | A-11 | Esquema de listas de precios (D-024)

-- Necesaria para la exclusion constraint que combina "=" (tipo_lista) con "&&" (rango de fechas)
create extension if not exists btree_gist;

-- A-11 | Lista de precios: una sola vigente a la vez por tipo de lista
create table public.lista_precio (
  id_lista_precio uuid primary key default gen_random_uuid(),
  nombre_lista_precio text not null
                      check (length(trim(nombre_lista_precio)) > 0),
  tipo_lista          public.tipo_lista_precio not null,
  fecha_inicio        date not null,
  fecha_fin           date,
  observaciones       text,
  creado              timestamptz not null default now(),
  editado             timestamptz not null default now(),
  creado_por          uuid not null default auth.uid()
                      references public.usuario(id_usuario),

  constraint lista_precio_fechas_chk
    check (fecha_fin is null or fecha_fin >= fecha_inicio),

  -- Dos listas del mismo tipo no pueden solaparse (fechas inclusivas: fin 31/10 + inicio 01/11 es válido)
  constraint lista_precio_sin_superposicion
    exclude using gist (
      tipo_lista with =,
      daterange(fecha_inicio, fecha_fin, '[]') with &&
    )
);

comment on table public.lista_precio is
  'A-11 | Lista de precios por tipo (Mayorista / Minorista). fecha_fin null = sin vencimiento. La exclusion constraint garantiza una sola lista vigente por tipo en cada fecha.';

-- Nombre único sin importar mayúsculas ni espacios de más
create unique index uq_lista_precio_nombre
  on public.lista_precio (lower(trim(nombre_lista_precio)));

-- A-11 | Precio de cada artículo dentro de una lista
create table public.lista_precio_detalle (
  id_lista_precio uuid not null
                  references public.lista_precio(id_lista_precio) on delete cascade,
  id_producto     uuid not null references public.producto(id_producto),
  precio          numeric(12,2) not null check (precio >= 0),
  creado          timestamptz not null default now(),
  editado         timestamptz not null default now(),

  primary key (id_lista_precio, id_producto)
);

comment on table public.lista_precio_detalle is
  'A-11 | Precio de un artículo en una lista de precios.';

create index idx_lista_precio_detalle_producto
  on public.lista_precio_detalle (id_producto);

-- Triggers de "editado" (mismo patrón que set_editado_tipo_cliente)
create or replace function public.set_editado_lista_precio()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.editado := now();
  new.creado := old.creado;
  new.creado_por := old.creado_por;
  return new;
end;
$$;

create or replace function public.set_editado_lista_precio_detalle()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.editado := now();
  new.creado := old.creado;
  return new;
end;
$$;

create trigger trg_set_editado_lista_precio
  before update on public.lista_precio
  for each row execute function public.set_editado_lista_precio();

create trigger trg_set_editado_lista_precio_detalle
  before update on public.lista_precio_detalle
  for each row execute function public.set_editado_lista_precio_detalle();

-- RLS (D-010). Delete solo en el detalle: quitar un artículo de la lista; la lista en sí no se borra.
alter table public.lista_precio enable row level security;
alter table public.lista_precio_detalle enable row level security;

create policy lista_precio_select_authenticated on public.lista_precio
  for select to authenticated using (true);
create policy lista_precio_insert_authenticated on public.lista_precio
  for insert to authenticated with check (true);
create policy lista_precio_update_authenticated on public.lista_precio
  for update to authenticated using (true) with check (true);

create policy lista_precio_detalle_select_authenticated on public.lista_precio_detalle
  for select to authenticated using (true);
create policy lista_precio_detalle_insert_authenticated on public.lista_precio_detalle
  for insert to authenticated with check (true);
create policy lista_precio_detalle_update_authenticated on public.lista_precio_detalle
  for update to authenticated using (true) with check (true);
create policy lista_precio_detalle_delete_authenticated on public.lista_precio_detalle
  for delete to authenticated using (true);

-- Seed: una lista vigente por tipo, cargada desde los precios actuales del producto
with autor as (
  select id_usuario from public.usuario
  where rol_usuario = 'Gerente' order by creado limit 1
), listas as (
  insert into public.lista_precio
    (nombre_lista_precio, tipo_lista, fecha_inicio, fecha_fin, observaciones, creado_por)
  select v.nombre, v.tipo::public.tipo_lista_precio, current_date, null,
         'Sembrada desde producto.precio_' || lower(v.tipo) || '_producto (S4-2).',
         (select id_usuario from autor)
  from (values ('Lista Mayorista inicial', 'Mayorista'),
               ('Lista Minorista inicial', 'Minorista')) as v(nombre, tipo)
  returning id_lista_precio, tipo_lista
)
insert into public.lista_precio_detalle (id_lista_precio, id_producto, precio)
select l.id_lista_precio, p.id_producto,
       case l.tipo_lista when 'Mayorista' then p.precio_mayorista_producto
                         else p.precio_minorista_producto end
from listas l
cross join public.producto p
where case l.tipo_lista when 'Mayorista' then p.precio_mayorista_producto
                        else p.precio_minorista_producto end > 0;
