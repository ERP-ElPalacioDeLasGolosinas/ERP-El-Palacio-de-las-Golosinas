-- CJV-12 (adoptar): el flujo viejo de apertura se saltea la autorizacion del gerente.
-- Nada en la base ni en el frontend la usa (verificado en pg_proc.prosrc).
drop function if exists public.fn_caja_abrir(numeric, text, uuid, uuid);
