-- S5-1a (D-030): cierra las politicas RLS abiertas (`true`) del resto de las tablas.
-- Un cliente web es `authenticated` pero no tiene fila en `usuario`; con es_personal_erp()
-- deja de leer/escribir tablas del ERP por PostgREST. El personal no cambia: toda cuenta de
-- empleado/gerente tiene fila en `usuario`. Se conservan nombre, comando y rol de cada politica.
-- Reversion: recrear cada politica con `true` (los nombres no cambian).
do $$
declare
  r record;
  v_using text;
  v_check text;
  v_sql text;
begin
  for r in
    select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (qual = 'true' or with_check = 'true')
  loop
    v_using := case when r.qual = 'true' then 'public.es_personal_erp()' else r.qual end;
    v_check := case when r.with_check = 'true' then 'public.es_personal_erp()' else r.with_check end;

    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);

    v_sql := format('create policy %I on %I.%I as %s for %s to %s',
      r.policyname, r.schemaname, r.tablename, r.permissive, r.cmd,
      (select string_agg(quote_ident(x), ', ') from unnest(r.roles) x));
    if v_using is not null then v_sql := v_sql || ' using (' || v_using || ')'; end if;
    if v_check is not null then v_sql := v_sql || ' with check (' || v_check || ')'; end if;
    execute v_sql;
  end loop;
end $$;
