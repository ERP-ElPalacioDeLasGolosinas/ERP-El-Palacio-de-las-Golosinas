-- S5-1a (U-06): enlace opcional entre cliente y usuario de Supabase Auth (cliente web).
-- Aditiva: columna nullable y unica; los clientes existentes quedan en NULL.
-- ON DELETE SET NULL: borrar la cuenta de acceso no debe borrar al cliente ni sus ventas.

alter table public.cliente
  add column id_usuario uuid;

alter table public.cliente
  add constraint cliente_id_usuario_fkey
  foreign key (id_usuario) references auth.users (id) on delete set null;

alter table public.cliente
  add constraint uq_cliente_id_usuario unique (id_usuario);

comment on column public.cliente.id_usuario is
  'Usuario de Supabase Auth del cliente web (U-06). NULL = cliente sin acceso a la tienda.';
