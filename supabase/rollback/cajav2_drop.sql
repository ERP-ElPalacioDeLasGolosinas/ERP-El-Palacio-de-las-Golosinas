-- Borra todo lo creado por 20261014120000_cajav2_sesion_autorizada.sql y
-- 20261014130000_cajav2_levantar.sql.
-- NO es una migracion: se corre a mano solo si se descarta el flujo cajav2.
--
-- Las filas de public.caja / movimiento_caja / arqueo_caja que nacieron de
-- sesiones cajav2 NO se borran: son cajas normales (ventas, cobros, arqueos).
-- Si quedo alguna caja abierta por cajav2, cerrala antes (o queda abierta como
-- una caja comun, operable con el flujo viejo).

begin;

drop trigger if exists trg_cajav2_validar_movimiento on public.movimiento_caja;
drop trigger if exists trg_cajav2_validar_arqueo on public.arqueo_caja;
drop trigger if exists trg_cajav2_sincronizar_cierre on public.caja;

drop function if exists public.fn_cajav2_levantar(uuid, uuid, numeric, text);
drop function if exists public.fn_cajav2_empleados_disponibles();
drop function if exists public.fn_cajav2_es_empleado_ventas(uuid);
drop function if exists public.fn_cajav2_cerrar(uuid, text);
drop function if exists public.fn_cajav2_rechazar_cierre(uuid, text);
drop function if exists public.fn_cajav2_solicitar_cierre(uuid, text);
drop function if exists public.fn_cajav2_rechazar_apertura(uuid, text);
drop function if exists public.fn_cajav2_aprobar_apertura(uuid);
drop function if exists public.fn_cajav2_solicitar_apertura(uuid, numeric, text);
drop function if exists public.fn_cajav2_sesion_de_caja(uuid);
drop function if exists public.fn_cajav2_mi_sesion();
drop function if exists public.fn_cajav2_panel();
drop function if exists public.fn_cajav2_registradora_guardar(uuid, integer, text, uuid, boolean);
drop function if exists public.fn_cajav2_sincronizar_cierre();
drop function if exists public.fn_cajav2_validar_operacion();

drop view if exists public.cajav2_vw_sesion;
drop table if exists public.cajav2_sesion;
drop table if exists public.cajav2_registradora;

drop function if exists public.fn_cajav2_es_gerente();

notify pgrst, 'reload schema';

commit;
