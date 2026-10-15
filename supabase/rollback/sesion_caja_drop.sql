-- Borra todo lo creado por 20261014120000_sesion_caja_autorizada.sql y
-- 20261014130000_cajav2_levantar.sql.
-- NO es una migracion: se corre a mano solo para deshacer las sesiones autorizadas.
-- Desde 20261014150000 los objetos tienen los nombres definitivos (sin prefijo cajav2).
-- Ojo: fn_caja_abrir ya no existe (20261014140000); sin este flujo no hay forma de abrir cajas.
--
-- Las filas de public.caja / movimiento_caja / arqueo_caja que nacieron de
-- sesiones cajav2 NO se borran: son cajas normales (ventas, cobros, arqueos).
-- Si quedo alguna caja abierta por cajav2, cerrala antes (o queda abierta como
-- una caja comun, operable con el flujo viejo).

begin;

drop trigger if exists trg_sesion_caja_validar_movimiento on public.movimiento_caja;
drop trigger if exists trg_sesion_caja_validar_arqueo on public.arqueo_caja;
drop trigger if exists trg_sesion_caja_sincronizar_cierre on public.caja;

drop function if exists public.fn_sesion_caja_levantar(uuid, uuid, numeric, text);
drop function if exists public.fn_sesion_caja_empleados_disponibles();
drop function if exists public.fn_caja_es_empleado_ventas(uuid);
drop function if exists public.fn_sesion_caja_cerrar(uuid, text);
drop function if exists public.fn_sesion_caja_rechazar_cierre(uuid, text);
drop function if exists public.fn_sesion_caja_solicitar_cierre(uuid, text);
drop function if exists public.fn_sesion_caja_rechazar_apertura(uuid, text);
drop function if exists public.fn_sesion_caja_aprobar_apertura(uuid);
drop function if exists public.fn_sesion_caja_solicitar_apertura(uuid, numeric, text);
drop function if exists public.fn_sesion_caja_sesion_de_caja(uuid);
drop function if exists public.fn_sesion_caja_mi_sesion();
drop function if exists public.fn_caja_panel();
drop function if exists public.fn_caja_registradora_guardar(uuid, integer, text, uuid, boolean);
drop function if exists public.fn_sesion_caja_sincronizar_cierre();
drop function if exists public.fn_sesion_caja_validar_operacion();

drop view if exists public.vw_sesion_caja;
drop table if exists public.sesion_caja;
drop table if exists public.caja_registradora;

drop function if exists public.fn_caja_es_gerente();

notify pgrst, 'reload schema';

commit;
