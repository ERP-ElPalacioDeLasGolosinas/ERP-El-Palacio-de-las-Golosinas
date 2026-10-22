-- S5-19e: costo de envio a domicilio visible para el checkout.
-- Funcion nueva (no modifica ninguna existente). tienda_parametro solo la lee el personal (D-030),
-- asi que el cliente web obtiene unicamente este valor por funcion. Devuelve 0 si el parametro falta
-- o no es numerico. Reversion: drop function public.fn_tienda_costo_envio();
create or replace function public.fn_tienda_costo_envio()
returns numeric
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce((
    select case when valor ~ '^[0-9]+(\.[0-9]+)?$' then valor::numeric end
    from public.tienda_parametro
    where clave = 'costo_envio'
  ), 0);
$function$;

revoke all on function public.fn_tienda_costo_envio() from public, anon;
grant execute on function public.fn_tienda_costo_envio() to authenticated, service_role;
