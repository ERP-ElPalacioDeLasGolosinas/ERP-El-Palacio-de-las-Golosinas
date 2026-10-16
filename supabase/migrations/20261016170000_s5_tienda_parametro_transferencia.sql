-- S5-6a (E-05): datos bancarios para la transferencia, como parametro de la tienda.
-- Tabla clave/valor editable solo por el personal (RLS, D-030); el cliente web lee unicamente
-- por fn_tienda_datos_transferencia() (D-028). Valores vacios hasta que el negocio los cargue.
-- Aditiva: tabla y funcion nuevas. Reversion: drop function public.fn_tienda_datos_transferencia();
-- drop table public.tienda_parametro.
create table public.tienda_parametro (
  clave   text primary key,
  valor   text not null default '',
  editado timestamptz not null default now()
);

alter table public.tienda_parametro enable row level security;
create policy tienda_parametro_select_personal on public.tienda_parametro
  as permissive for select to authenticated using (public.es_personal_erp());
create policy tienda_parametro_update_personal on public.tienda_parametro
  as permissive for update to authenticated
  using (public.es_personal_erp()) with check (public.es_personal_erp());
revoke all on public.tienda_parametro from anon;

insert into public.tienda_parametro (clave) values
  ('transferencia_titular'), ('transferencia_banco'), ('transferencia_cbu'),
  ('transferencia_alias'), ('transferencia_cuit'), ('transferencia_instrucciones');

comment on table public.tienda_parametro is
  'Parametros de la tienda online (clave/valor). transferencia_*: datos bancarios de E-05.';

create or replace function public.fn_tienda_datos_transferencia()
returns table(clave text, valor text)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select p.clave, p.valor
  from public.tienda_parametro p
  where p.clave like 'transferencia\_%' and btrim(p.valor) <> ''
  order by p.clave;
$function$;

revoke all on function public.fn_tienda_datos_transferencia() from public, anon;
grant execute on function public.fn_tienda_datos_transferencia() to authenticated, service_role;
