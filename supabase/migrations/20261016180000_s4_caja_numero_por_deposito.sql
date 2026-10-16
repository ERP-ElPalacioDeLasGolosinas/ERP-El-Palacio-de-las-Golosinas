-- El numero de caja se repite entre sucursales. Dentro de un deposito sigue siendo unico.

alter table public.caja_registradora drop constraint if exists caja_registradora_numero_uk;

alter table public.caja_registradora
  add constraint caja_registradora_deposito_numero_uk unique (id_deposito, numero);

create or replace function public.fn_caja_registradora_guardar(
  p_id_registradora uuid,
  p_numero integer,
  p_nombre text,
  p_id_deposito uuid,
  p_activa boolean default true
)
returns public.caja_registradora
language plpgsql
set search_path to 'public'
as $$
declare
  v_reg public.caja_registradora;
begin
  if not public.fn_caja_es_gerente() then
    raise exception 'Solo el gerente puede administrar las cajas' using errcode = 'SCJ01';
  end if;
  if p_numero is null or p_numero <= 0 then
    raise exception 'El numero de caja tiene que ser mayor a cero' using errcode = 'SCJ02';
  end if;
  if p_id_deposito is null
     or not exists (select 1 from public.deposito where id_deposito = p_id_deposito and activo) then
    raise exception 'Elegi un deposito activo: la caja vende el stock de esa sucursal' using errcode = 'SCJ02';
  end if;

  if exists (
    select 1
    from public.caja_registradora r
    where r.id_deposito = p_id_deposito
      and r.numero = p_numero
      and (p_id_registradora is null or r.id_registradora <> p_id_registradora)
  ) then
    raise exception 'Ya existe una caja con el numero % en esta sucursal', p_numero using errcode = 'SCJ02';
  end if;

  if p_id_registradora is null then
    insert into public.caja_registradora (numero, nombre, id_deposito, activa)
    values (p_numero, nullif(btrim(p_nombre), ''), p_id_deposito, coalesce(p_activa, true))
    returning * into v_reg;
    return v_reg;
  end if;

  if exists (
    select 1 from public.sesion_caja
    where id_registradora = p_id_registradora
      and estado in ('Pendiente', 'Abierta', 'Cierre solicitado')
  ) then
    raise exception 'La caja tiene una sesion activa: cerrala antes de modificarla' using errcode = 'SCJ03';
  end if;

  update public.caja_registradora
  set numero = p_numero,
      nombre = nullif(btrim(p_nombre), ''),
      id_deposito = p_id_deposito,
      activa = coalesce(p_activa, activa),
      editado = now()
  where id_registradora = p_id_registradora
  returning * into v_reg;

  if v_reg.id_registradora is null then
    raise exception 'La caja indicada no existe' using errcode = 'SCJ02';
  end if;
  return v_reg;
end;
$$;
