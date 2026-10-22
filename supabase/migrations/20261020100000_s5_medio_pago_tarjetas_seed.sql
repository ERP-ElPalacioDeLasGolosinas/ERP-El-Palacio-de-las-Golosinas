-- S5-18c: medios de pago de la tienda (Transferencia, Tarjeta de debito, Tarjeta de credito).
-- 1) cuenta_tesoreria_tienda = Banco Macro (decision del usuario 2026-10-20), solo si esta vacia.
-- 2) Alta de los medios "Tarjeta de débito" / "Tarjeta de crédito" (requiere_referencia) si no existen.
--    creado_por es NOT NULL y auth.uid() es null en una migracion: se toma el del medio Transferencia.
-- 3) Vinculo en medio_pago_cuenta de los 3 medios web con la cuenta de la tienda (si esta cargada).
-- Aditiva e idempotente: no toca funciones ni datos existentes.
-- Reversion: borrar los vinculos y los dos medios nuevos (si no tienen cobros) y vaciar el parametro.

update public.tienda_parametro tp
set valor = ct.id_cuenta::text, editado = now()
from public.cuenta_tesoreria ct
where tp.clave = 'cuenta_tesoreria_tienda'
  and btrim(tp.valor) = ''
  and ct.nombre_cuenta = 'Banco Macro'
  and ct.activo;

insert into public.medio_pago (nombre_medio_pago, tipo, requiere_referencia, creado_por)
select v.nombre, v.tipo::public.tipo_medio_pago, true, t.creado_por
from (values ('Tarjeta de débito', 'Tarjeta de débito'),
             ('Tarjeta de crédito', 'Tarjeta de crédito')) as v(nombre, tipo)
cross join (select creado_por from public.medio_pago where nombre_medio_pago = 'Transferencia') t
where not exists (
  select 1 from public.medio_pago mp
  where mp.tipo = v.tipo::public.tipo_medio_pago and mp.activo
)
on conflict (nombre_medio_pago) do nothing;

do $$
declare
  v_cuenta uuid;
begin
  select nullif(btrim(valor), '')::uuid into v_cuenta
  from public.tienda_parametro where clave = 'cuenta_tesoreria_tienda';

  if v_cuenta is null then
    raise notice 'cuenta_tesoreria_tienda vacia: cargarla y vincular los medios web, o el pago cae en PWB07';
    return;
  end if;

  insert into public.medio_pago_cuenta (id_medio_pago, id_cuenta_tesoreria)
  select mp.id_medio_pago, v_cuenta
  from public.medio_pago mp
  where mp.activo
    and mp.tipo in ('Transferencia', 'Tarjeta de débito', 'Tarjeta de crédito')
  on conflict (id_medio_pago, id_cuenta_tesoreria) do nothing;
end $$;
