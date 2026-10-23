-- Fix: pagar un pedido web con la sesion de un cliente web fallaba al descontar stock.
-- set_editado_por (triggers de inventario e inventario_producto) asignaba siempre auth.uid(), y un
-- cliente web no esta en public.usuario (FK editado_por). Ahora solo asigna auth.uid() si es un
-- usuario del ERP; si no, conserva el valor previo de la fila.
-- Reversion: restaurar `new.editado_por := auth.uid();`.

create or replace function public.set_editado_por()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if exists (select 1 from public.usuario u where u.id_usuario = auth.uid()) then
    new.editado_por := auth.uid();
  end if;
  return new;
end;
$function$;
