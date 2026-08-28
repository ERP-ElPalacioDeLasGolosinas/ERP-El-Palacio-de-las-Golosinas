-- S-04: Gestionar tipos de movimiento de stock
-- Migración incremental sobre 20260820120000_create_tipo_movimiento.sql.
-- Registra en el repo dos cambios ya aplicados manualmente al Supabase compartido:
--   1) el signo de un tipo de movimiento pasa a ser inmutable después del alta;
--   2) se elimina la posibilidad de DELETE físico para "authenticated" (la baja es
--      siempre lógica, vía la columna "activo").
-- No crea ni modifica ninguna otra tabla (producto, lote, lote_deposito, vistas,
-- movimiento_stock) ni toca roles/RBAC.

-- 1) Signo inmutable después del alta.
create or replace function public.fn_tipo_movimiento_signo_inmutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.signo_tipo_movimiento is distinct from old.signo_tipo_movimiento then
    raise exception
      'El signo del tipo de movimiento no puede modificarse una vez creado.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tipo_movimiento_signo_inmutable
  on public.tipo_movimiento;

create trigger trg_tipo_movimiento_signo_inmutable
  before update on public.tipo_movimiento
  for each row
  execute function public.fn_tipo_movimiento_signo_inmutable();

-- 2) Sin DELETE físico: se retira la policy de DELETE y se revoca el privilegio.
--    La baja de un tipo de movimiento se hace exclusivamente con activo = false.
drop policy if exists tipo_movimiento_delete on public.tipo_movimiento;

revoke delete on table public.tipo_movimiento from authenticated;
