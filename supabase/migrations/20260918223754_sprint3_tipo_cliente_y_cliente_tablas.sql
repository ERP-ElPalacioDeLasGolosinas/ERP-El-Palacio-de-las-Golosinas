-- Versionada en el repo el 2026-10-07 (S4-1) a partir de supabase_migrations.schema_migrations.
-- Ya aplicada en la nube con esta misma version; no reaplicar.

-- Lista de precios que puede usar un tipo de cliente
create type public.tipo_lista_precio as enum ('Minorista', 'Mayorista');

-- V-05 | Tipos de cliente
create table public.tipo_cliente (
  id_tipo_cliente     uuid primary key default gen_random_uuid(),
  nombre_tipo_cliente text not null
                      check (length(trim(nombre_tipo_cliente)) > 0),
  lista_precio        public.tipo_lista_precio not null,
  activo              boolean not null default true,
  creado              timestamptz not null default now(),
  editado             timestamptz not null default now(),
  creado_por          uuid not null default auth.uid()
                      references public.usuario(id_usuario)
);

comment on table public.tipo_cliente is
  'V-05 | Catálogo de tipos de cliente. lista_precio define si al cliente se le aplica el precio minorista o mayorista del producto.';

-- Nombre único sin importar mayúsculas ni espacios de más
create unique index uq_tipo_cliente_nombre
  on public.tipo_cliente (lower(trim(nombre_tipo_cliente)));

-- V-06 | Cartera de clientes
create table public.cliente (
  id_cliente          uuid primary key default gen_random_uuid(),
  nombre_cliente      text not null
                      check (length(trim(nombre_cliente)) > 0),
  id_tipo_cliente     uuid not null references public.tipo_cliente(id_tipo_cliente),
  documento_cliente   text,
  telefono_cliente    text,
  mail_cliente        text,
  direccion_cliente   text,
  es_consumidor_final boolean not null default false,
  activo              boolean not null default true,
  creado              timestamptz not null default now(),
  editado             timestamptz not null default now(),
  creado_por          uuid not null default auth.uid()
                      references public.usuario(id_usuario),

  constraint uq_cliente_documento unique (documento_cliente),

  -- DNI (7 u 8 dígitos) o CUIT (XX-XXXXXXXX-X)
  constraint cliente_documento_chk
    check (documento_cliente ~ '^[0-9]{7,8}$'
        or documento_cliente ~ '^[0-9]{2}-[0-9]{8}-[0-9]{1}$'),

  constraint cliente_telefono_chk
    check (telefono_cliente ~ '^[0-9]{6,15}$'),

  constraint cliente_mail_chk
    check (mail_cliente ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),

  constraint cliente_direccion_chk
    check (length(trim(direccion_cliente)) > 0),

  -- Obligatorios de V-06, salvo para el Consumidor Final
  constraint cliente_obligatorios_chk
    check (es_consumidor_final
           or (documento_cliente is not null and telefono_cliente is not null))
);

comment on table public.cliente is
  'V-06 | Cartera de clientes. El registro con es_consumidor_final = true es el cliente genérico por defecto de las ventas y no se puede modificar ni inhabilitar.';

-- Solo puede existir un cliente Consumidor Final
create unique index uq_cliente_consumidor_final
  on public.cliente (es_consumidor_final) where es_consumidor_final;

create index idx_cliente_tipo on public.cliente (id_tipo_cliente);

-- Triggers de "editado" (mismo patrón que set_editado_proveedor)
create or replace function public.set_editado_tipo_cliente()
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

create or replace function public.set_editado_cliente()
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

create trigger trg_set_editado_tipo_cliente
  before update on public.tipo_cliente
  for each row execute function public.set_editado_tipo_cliente();

create trigger trg_set_editado_cliente
  before update on public.cliente
  for each row execute function public.set_editado_cliente();

-- RLS (mismo criterio que proveedor y medio_pago; sin delete porque no se borra)
alter table public.tipo_cliente enable row level security;
alter table public.cliente enable row level security;

create policy tipo_cliente_select_authenticated on public.tipo_cliente
  for select to authenticated using (true);
create policy tipo_cliente_insert_authenticated on public.tipo_cliente
  for insert to authenticated with check (true);
create policy tipo_cliente_update_authenticated on public.tipo_cliente
  for update to authenticated using (true) with check (true);

create policy cliente_select_authenticated on public.cliente
  for select to authenticated using (true);
create policy cliente_insert_authenticated on public.cliente
  for insert to authenticated with check (true);
create policy cliente_update_authenticated on public.cliente
  for update to authenticated using (true) with check (true);
