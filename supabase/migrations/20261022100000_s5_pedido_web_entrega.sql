-- S5-19a · Esquema de entrega del pedido web (envío a domicilio o retiro por sucursal).
-- Solo agrega: no modifica funciones ni filas existentes. Los pedidos anteriores quedan con
-- tipo_entrega NULL (sin dato de entrega); las funciones S5-19c/d lo exigirán en los nuevos.

alter type public.estado_pedido_web add value if not exists 'Listo para retirar';
alter type public.estado_pedido_web add value if not exists 'Retirado';

do $$
begin
  if not exists (select 1 from pg_type where typname = 'tipo_entrega_pedido') then
    create type public.tipo_entrega_pedido as enum ('Envío a domicilio', 'Retiro por sucursal');
  end if;
end $$;

alter table public.pedido_web
  add column if not exists tipo_entrega        public.tipo_entrega_pedido,
  add column if not exists costo_envio         numeric(12,2) not null default 0,
  add column if not exists envio_destinatario  text,
  add column if not exists envio_direccion     text,
  add column if not exists envio_localidad     text,
  add column if not exists envio_observaciones text,
  add column if not exists id_deposito_retiro  uuid references public.deposito(id_deposito);

alter table public.pedido_web
  add constraint pedido_web_costo_envio_chk check (costo_envio >= 0),
  add constraint pedido_web_entrega_chk check (
    tipo_entrega is null
    or (tipo_entrega = 'Envío a domicilio'
        and nullif(btrim(envio_destinatario), '') is not null
        and nullif(btrim(envio_direccion), '') is not null
        and nullif(btrim(envio_localidad), '') is not null
        and id_deposito_retiro is null)
    or (tipo_entrega = 'Retiro por sucursal'
        and id_deposito_retiro is not null
        and costo_envio = 0)
  );

insert into public.tienda_parametro (clave, valor)
values ('costo_envio', '4000')
on conflict (clave) do nothing;
