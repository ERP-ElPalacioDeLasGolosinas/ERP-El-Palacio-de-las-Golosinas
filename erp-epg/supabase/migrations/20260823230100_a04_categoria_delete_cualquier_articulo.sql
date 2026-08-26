-- A-04 | Fix: bloquear DELETE de categoría con cualquier artículo asociado
-- (no solo activos). Idempotente: se puede correr aunque ya exista la función.

create or replace function public.categoria_motivo_bloqueo_delete(p_id_categoria uuid)
returns text
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_tiene_articulos boolean := false;
begin
  if p_id_categoria is null then
    return null;
  end if;

  if to_regclass('public.producto') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'producto'
         and column_name = 'id_categoria'
     )
  then
    execute $q$
      select exists (
        select 1
        from public.producto p
        where p.id_categoria = $1
      )
    $q$
    into v_tiene_articulos
    using p_id_categoria;
  end if;

  if coalesce(v_tiene_articulos, false) then
    return 'No se puede eliminar la categoría porque tiene artículos asociados.';
  end if;

  return null;
end;
$$;
