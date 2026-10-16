-- S5-1c (U-06): el cliente web no lee `cliente` por RLS (D-030); obtiene su propia fila por funcion.
-- Devuelve el cliente enlazado a auth.uid() o ninguna fila.
create or replace function public.fn_cliente_web_obtener()
returns table (id_cliente uuid, nombre_cliente text, documento_cliente text,
  telefono_cliente text, mail_cliente text, direccion_cliente text)
language sql
stable
security definer
set search_path = public
as $$
  select c.id_cliente, c.nombre_cliente, c.documento_cliente, c.telefono_cliente,
         c.mail_cliente, c.direccion_cliente
  from public.cliente c
  where c.id_usuario = auth.uid() and c.activo = true;
$$;

revoke all on function public.fn_cliente_web_obtener() from public, anon;
grant execute on function public.fn_cliente_web_obtener() to authenticated;
