-- S5-1a (D-030): preparar `cliente` para el cliente web.
-- 1) creado_por NULL = autoregistro desde la tienda.
-- 2) es_personal_erp(): true si auth.uid() tiene fila en `usuario` (empleado/gerente).
-- 3) Las politicas de `cliente` pasan de `true` a es_personal_erp(): un cliente web
--    autenticado no puede leer ni editar clientes por PostgREST.
-- 4) fn_cliente_listar muestra 'Tienda online' cuando creado_por es NULL.

alter table public.cliente alter column creado_por drop not null;

create or replace function public.es_personal_erp()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.usuario where id_usuario = auth.uid());
$$;

revoke all on function public.es_personal_erp() from public, anon;
grant execute on function public.es_personal_erp() to authenticated;

drop policy if exists cliente_select_authenticated on public.cliente;
drop policy if exists cliente_insert_authenticated on public.cliente;
drop policy if exists cliente_update_authenticated on public.cliente;

create policy cliente_select_authenticated on public.cliente
  for select to authenticated using (public.es_personal_erp());
create policy cliente_insert_authenticated on public.cliente
  for insert to authenticated with check (public.es_personal_erp());
create policy cliente_update_authenticated on public.cliente
  for update to authenticated using (public.es_personal_erp()) with check (public.es_personal_erp());

create or replace function public.fn_cliente_listar(p_incluir_inactivos boolean default true)
returns table(id_cliente uuid, nombre_cliente text, id_tipo_cliente uuid, nombre_tipo_cliente text,
  lista_precio tipo_lista_precio, documento_cliente text, telefono_cliente text, mail_cliente text,
  direccion_cliente text, es_consumidor_final boolean, activo boolean, creado timestamptz,
  editado timestamptz, creado_por uuid, creado_por_nombre text)
language sql
stable
set search_path to 'public'
as $function$
  select
    c.id_cliente,
    c.nombre_cliente,
    c.id_tipo_cliente,
    t.nombre_tipo_cliente,
    t.lista_precio,
    c.documento_cliente,
    c.telefono_cliente,
    c.mail_cliente,
    c.direccion_cliente,
    c.es_consumidor_final,
    c.activo,
    c.creado,
    c.editado,
    c.creado_por,
    case when c.creado_por is null then 'Tienda online'
         else coalesce(ur.nombre_completo, 'Usuario no disponible') end as creado_por_nombre
  from public.cliente c
  join public.tipo_cliente t on t.id_tipo_cliente = c.id_tipo_cliente
  left join public.vw_usuario_resumen ur on ur.id_usuario = c.creado_por
  where p_incluir_inactivos or c.activo = true
  order by c.nombre_cliente;
$function$;
