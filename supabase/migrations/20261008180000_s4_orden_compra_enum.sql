-- C-03 | Estados de la orden de compra. El valor no se usa en esta transaccion.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'estado_orden_compra') then
    create type public.estado_orden_compra as enum (
      'Pendiente',
      'Recibida parcial',
      'Recibida total',
      'Cancelada'
    );
  end if;
end $$;
