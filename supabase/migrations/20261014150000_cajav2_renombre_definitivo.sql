-- CJV-12 (adoptar): nombres definitivos del flujo cajav2. Solo renombra; no cambia datos ni logica.
--   cajav2_registradora -> caja_registradora      cajav2_sesion -> sesion_caja
--   cajav2_vw_sesion    -> vw_sesion_caja         fn_cajav2_*   -> fn_sesion_caja_*
--   fn_cajav2_{registradora_guardar,es_gerente,es_empleado_ventas,panel} -> fn_caja_*
--   trg_cajav2_* -> trg_sesion_caja_*             errcodes CJV01..06 -> SCJ01..06
-- Choques descartados: fn_caja_cerrar y CAJ0x ya existian; por eso las sesiones usan fn_sesion_caja_*.
do $$
declare
  r record;
  v_oids oid[] := '{}';
  v_oid oid;
  v_def text;
begin
  -- 1) tablas y vista
  alter table public.cajav2_registradora rename to caja_registradora;
  alter table public.cajav2_sesion rename to sesion_caja;
  alter view public.cajav2_vw_sesion rename to vw_sesion_caja;

  -- 2) constraints (renombra tambien su indice)
  for r in
    select c.conrelid::regclass::text as tabla, c.conname
    from pg_constraint c
    where c.conname like 'cajav2\_%' and c.conrelid in ('public.caja_registradora'::regclass, 'public.sesion_caja'::regclass)
  loop
    execute format('alter table %s rename constraint %I to %I', r.tabla, r.conname,
      replace(replace(r.conname, 'cajav2_registradora', 'caja_registradora'), 'cajav2_sesion', 'sesion_caja'));
  end loop;

  -- 3) indices que no son de constraint
  for r in
    select c.relname from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind = 'i' and c.relname like 'cajav2\_%'
  loop
    execute format('alter index public.%I rename to %I', r.relname,
      replace(replace(r.relname, 'cajav2_registradora', 'caja_registradora'), 'cajav2_sesion', 'sesion_caja'));
  end loop;

  -- 4) politicas
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and policyname like 'cajav2\_%'
  loop
    execute format('alter policy %I on public.%I rename to %I', r.policyname, r.tablename,
      replace(replace(r.policyname, 'cajav2_registradora', 'caja_registradora'), 'cajav2_sesion', 'sesion_caja'));
  end loop;

  -- 5) triggers
  for r in
    select t.tgname, t.tgrelid::regclass::text as tabla from pg_trigger t
    where t.tgname like 'trg\_cajav2\_%' and not t.tgisinternal
  loop
    execute format('alter trigger %I on %s rename to %I', r.tgname, r.tabla,
      replace(r.tgname, 'trg_cajav2_', 'trg_sesion_caja_'));
  end loop;

  -- 6) funciones: primero se renombran (los triggers y politicas siguen apuntando por oid)...
  for r in
    select p.oid, p.oid::regprocedure::text as firma, p.proname
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'fn\_cajav2\_%'
  loop
    v_oids := v_oids || r.oid;
    execute format('alter function %s rename to %I', r.firma,
      case r.proname
        when 'fn_cajav2_registradora_guardar' then 'fn_caja_registradora_guardar'
        when 'fn_cajav2_es_gerente' then 'fn_caja_es_gerente'
        when 'fn_cajav2_es_empleado_ventas' then 'fn_caja_es_empleado_ventas'
        when 'fn_cajav2_panel' then 'fn_caja_panel'
        else replace(r.proname, 'fn_cajav2_', 'fn_sesion_caja_')
      end);
  end loop;

  -- ...y despues se reescribe el cuerpo con los nombres y errcodes nuevos.
  foreach v_oid in array v_oids loop
    v_def := pg_get_functiondef(v_oid);
    v_def := replace(v_def, 'fn_cajav2_registradora_guardar', 'fn_caja_registradora_guardar');
    v_def := replace(v_def, 'fn_cajav2_es_gerente', 'fn_caja_es_gerente');
    v_def := replace(v_def, 'fn_cajav2_es_empleado_ventas', 'fn_caja_es_empleado_ventas');
    v_def := replace(v_def, 'fn_cajav2_panel', 'fn_caja_panel');
    v_def := replace(v_def, 'fn_cajav2_', 'fn_sesion_caja_');
    v_def := replace(v_def, 'trg_cajav2_', 'trg_sesion_caja_');
    v_def := replace(v_def, 'cajav2_vw_sesion', 'vw_sesion_caja');
    v_def := replace(v_def, 'cajav2_registradora', 'caja_registradora');
    v_def := replace(v_def, 'cajav2_sesion', 'sesion_caja');
    v_def := replace(v_def, 'CJV', 'SCJ');
    execute v_def;
  end loop;
end $$;
