-- Endurecimiento de seguridad (auditoría QA 29/10).
--
-- 1. Las RPC SECURITY DEFINER del personal (stock y lotes) no verificaban quién las llamaba:
--    un cliente web (o anon, en las de lotes) podía registrar movimientos de stock o borrar lotes.
--    Se les agrega fn_exigir_personal_erp(). Las llamadas internas legítimas siguen funcionando:
--    las que no vienen de la API (sin JWT: migraciones, demo_seed) y el pago de un pedido web,
--    que marca la transacción con epg.llamada_interna antes de descontar stock.
-- 2. Las de solo lectura del personal pasan a SECURITY INVOKER: el RLS de cada tabla decide.
--    Por eso inventario e inventario_producto reciben política de lectura para el personal.
-- 3. anon pierde EXECUTE sobre todas las funciones salvo las del catálogo público de la tienda.
-- 4. vw_usuario_resumen (definer y actualizable) permitía a anon/authenticated escribir en
--    usuario salteando RLS: queda solo SELECT para authenticated.
-- 5. Un empleado podía cambiarse el rol (la política de usuario lo deja editar su fila):
--    solo el gerente cambia roles.
-- 6. search_path fijo en las funciones que el linter marca como mutables.

-- 1. Guardia para RPC del personal ------------------------------------------------------------

create or replace function public.fn_exigir_personal_erp(p_accion text)
returns void
language plpgsql
stable
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated')
     and coalesce(current_setting('epg.llamada_interna', true), '') <> 'on'
     and not public.es_personal_erp() then
    raise exception 'Solo el personal del ERP puede %', p_accion using errcode = '42501';
  end if;
end;
$$;

-- Inserta la guardia (o la marca de llamada interna) como primera sentencia del cuerpo.
do $$
declare
  r     record;
  v_def text;
begin
  for r in
    select p.oid, x.linea
    from pg_proc p
    join (values
      ('fn_movimiento_stock_registrar',       'perform public.fn_exigir_personal_erp(''registrar movimientos de stock'');'),
      ('fn_lote_registrar_desde_comprobante', 'perform public.fn_exigir_personal_erp(''registrar lotes'');'),
      ('fn_lote_eliminar',                    'perform public.fn_exigir_personal_erp(''eliminar lotes'');'),
      ('fn_lote_motivo_bloqueo_delete',       'perform public.fn_exigir_personal_erp(''consultar lotes'');'),
      ('fn_pedido_web_confirmar_pago_interno', 'perform set_config(''epg.llamada_interna'', ''on'', true);')
    ) x(proname, linea) on x.proname = p.proname
    where p.pronamespace = 'public'::regnamespace
  loop
    v_def := pg_get_functiondef(r.oid);
    continue when position(r.linea in v_def) > 0;
    -- Sin flag 'g': reemplaza solo el primer BEGIN, que es el del cuerpo.
    v_def := regexp_replace(v_def, '\mbegin\M', E'begin\n  ' || r.linea, 'i');
    execute v_def;
  end loop;
end;
$$;

-- 2. Lecturas del personal: el RLS decide -----------------------------------------------------

alter function public.fn_comprobante_listar_para_recepcion() security invoker;
alter function public.fn_inventario_producto_listar_por_producto(uuid, integer) security invoker;
alter function public.fn_inventario_producto_listar_recientes(uuid, integer) security invoker;
alter function public.fn_proveedor_listar_min() security invoker;
alter function public.fn_sesion_caja_empleados_disponibles() security invoker;

-- Las escrituras sobre lotes siguen pasando solo por las RPC SECURITY DEFINER.
drop policy if exists inventario_select_personal on public.inventario;
create policy inventario_select_personal on public.inventario
  for select to authenticated using (public.es_personal_erp());

drop policy if exists inventario_producto_select_personal on public.inventario_producto;
create policy inventario_producto_select_personal on public.inventario_producto
  for select to authenticated using (public.es_personal_erp());

-- 3. anon solo ejecuta el catálogo público de la tienda ---------------------------------------

do $$
declare
  r      record;
  v_auth boolean;
  v_svc  boolean;
begin
  for r in
    select p.oid, p.oid::regprocedure::text as firma
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prokind = 'f'
      and p.proname not in (
        'fn_tienda_catalogo_listar', 'fn_tienda_filtros_listar', 'fn_tienda_producto_obtener',
        'fn_tienda_carrito_validar', 'fn_tienda_sucursales_retiro')
      -- Las funciones de extensiones (btree_gist) no se tocan.
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    v_auth := has_function_privilege('authenticated', r.oid, 'execute');
    v_svc  := has_function_privilege('service_role', r.oid, 'execute');
    execute format('revoke execute on function %s from public, anon', r.firma);
    -- Revocar PUBLIC no debe quitarle nada a quien ya lo tenía.
    if v_auth then execute format('grant execute on function %s to authenticated', r.firma); end if;
    if v_svc  then execute format('grant execute on function %s to service_role', r.firma); end if;
  end loop;
end;
$$;

-- 4. Vistas: solo lectura y nada para anon ----------------------------------------------------

revoke all on public.vw_usuario_resumen from anon, authenticated;
grant select on public.vw_usuario_resumen to authenticated;

revoke all on public.vw_sesion_caja from anon, authenticated;
grant select on public.vw_sesion_caja to authenticated;

-- 5. Solo el gerente cambia roles -------------------------------------------------------------

create or replace function public.fn_usuario_proteger_rol()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.rol_usuario is distinct from old.rol_usuario or new.id_usuario is distinct from old.id_usuario)
     and coalesce(auth.role(), '') in ('anon', 'authenticated')
     and not public.fn_caja_es_gerente() then
    raise exception 'Solo el gerente puede cambiar el rol de un usuario' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.fn_usuario_proteger_rol() from public, anon;

drop trigger if exists trg_usuario_proteger_rol on public.usuario;
create trigger trg_usuario_proteger_rol
  before update on public.usuario
  for each row execute function public.fn_usuario_proteger_rol();

-- 6. search_path fijo -------------------------------------------------------------------------

alter function public.set_editado_pedido_web() set search_path = public;
alter function public.set_editado_ticket_soporte() set search_path = public;
alter function public.actualizar_editado_usuario() set search_path = public;
alter function public.set_editado_producto() set search_path = public;
alter function public.set_editado_marca() set search_path = public;
alter function public.set_editado_tipo_movimiento() set search_path = public;

do $$
declare
  r record;
begin
  -- El esquema de la carga de demo existe solo en las bases donde se corrió.
  for r in
    select p.oid::regprocedure::text as firma
    from pg_proc p
    where p.pronamespace = (select oid from pg_namespace where nspname = 'demo_seed')
      and p.proconfig is null
  loop
    execute format('alter function %s set search_path = demo_seed, public', r.firma);
  end loop;
end;
$$;
