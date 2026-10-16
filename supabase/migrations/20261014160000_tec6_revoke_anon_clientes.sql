-- TEC-6 / S5-0b: las funciones de clientes quedan ejecutables solo por authenticated y service_role.
-- Solo cambia privilegios; no se modifica ninguna función ni dato.

revoke execute on function public.fn_cliente_crear(text, uuid, text, text, uuid, text, text) from public, anon;
revoke execute on function public.fn_cliente_modificar(uuid, text, uuid, text, text, text, text) from public, anon;
revoke execute on function public.fn_cliente_habilitar(uuid) from public, anon;
revoke execute on function public.fn_cliente_inhabilitar(uuid) from public, anon;
revoke execute on function public.fn_cliente_listar(boolean) from public, anon;
revoke execute on function public.fn_tipo_cliente_crear(text, public.tipo_lista_precio, uuid) from public, anon;
revoke execute on function public.fn_tipo_cliente_modificar(uuid, text, public.tipo_lista_precio) from public, anon;
revoke execute on function public.fn_tipo_cliente_habilitar(uuid) from public, anon;
revoke execute on function public.fn_tipo_cliente_inhabilitar(uuid) from public, anon;
revoke execute on function public.fn_tipo_cliente_listar(boolean) from public, anon;

grant execute on function public.fn_cliente_crear(text, uuid, text, text, uuid, text, text) to authenticated, service_role;
grant execute on function public.fn_cliente_modificar(uuid, text, uuid, text, text, text, text) to authenticated, service_role;
grant execute on function public.fn_cliente_habilitar(uuid) to authenticated, service_role;
grant execute on function public.fn_cliente_inhabilitar(uuid) to authenticated, service_role;
grant execute on function public.fn_cliente_listar(boolean) to authenticated, service_role;
grant execute on function public.fn_tipo_cliente_crear(text, public.tipo_lista_precio, uuid) to authenticated, service_role;
grant execute on function public.fn_tipo_cliente_modificar(uuid, text, public.tipo_lista_precio) to authenticated, service_role;
grant execute on function public.fn_tipo_cliente_habilitar(uuid) to authenticated, service_role;
grant execute on function public.fn_tipo_cliente_inhabilitar(uuid) to authenticated, service_role;
grant execute on function public.fn_tipo_cliente_listar(boolean) to authenticated, service_role;
