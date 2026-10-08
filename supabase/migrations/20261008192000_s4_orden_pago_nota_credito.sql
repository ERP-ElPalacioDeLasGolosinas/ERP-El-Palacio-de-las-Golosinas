-- La orden de pago aplica notas de credito (el documento), no el saldo
-- neto de la cuenta corriente. Ese neto ya suma la nota y resta la factura.

create table if not exists public.orden_pago_nota_credito (
  id uuid primary key default gen_random_uuid(),
  id_orden_pago uuid not null references public.orden_pago (id_orden_pago) on delete cascade,
  id_comprobante uuid not null references public.comprobante_proveedor (id_comprobante),
  importe numeric(16,2) not null check (importe > 0),
  constraint orden_pago_nota_credito_uq unique (id_orden_pago, id_comprobante)
);

create table if not exists public.pago_nota_credito (
  id uuid primary key default gen_random_uuid(),
  id_pago uuid not null references public.pago (id_pago) on delete cascade,
  id_comprobante uuid not null references public.comprobante_proveedor (id_comprobante),
  importe numeric(16,2) not null check (importe > 0),
  constraint pago_nota_credito_uq unique (id_pago, id_comprobante)
);

alter table public.orden_pago_nota_credito enable row level security;
alter table public.pago_nota_credito enable row level security;

revoke all on table public.orden_pago_nota_credito from public, anon;
revoke all on table public.pago_nota_credito from public, anon;
grant select, insert, update, delete on public.orden_pago_nota_credito to authenticated, service_role;
grant select, insert, update, delete on public.pago_nota_credito to authenticated, service_role;

drop policy if exists "orden_pago_nota_credito_all_authenticated" on public.orden_pago_nota_credito;
create policy "orden_pago_nota_credito_all_authenticated"
  on public.orden_pago_nota_credito for all to authenticated using (true) with check (true);

drop policy if exists "pago_nota_credito_all_authenticated" on public.pago_nota_credito;
create policy "pago_nota_credito_all_authenticated"
  on public.pago_nota_credito for all to authenticated using (true) with check (true);

create or replace function public.fn_nota_credito_disponible(
  p_id_comprobante uuid,
  p_excluir_orden uuid default null
)
returns numeric
language sql
stable
set search_path to 'public'
as $$
  select greatest(0, round(
    c.importe_total
    - coalesce(n.importe_aplicado, 0)
    - coalesce((
        select sum(greatest(r.importe - coalesce(pg.usado, 0), 0))
        from public.orden_pago_nota_credito r
        join public.orden_pago o on o.id_orden_pago = r.id_orden_pago
        left join lateral (
          select coalesce(sum(pn.importe), 0) as usado
          from public.pago_nota_credito pn
          join public.pago pg on pg.id_pago = pn.id_pago
          where pg.id_orden_pago = r.id_orden_pago
            and pn.id_comprobante = r.id_comprobante
        ) pg on true
        where r.id_comprobante = c.id_comprobante
          and o.estado in ('Borrador', 'Pendiente de pago', 'Pagada parcial')
          and (p_excluir_orden is null or o.id_orden_pago <> p_excluir_orden)
      ), 0)
  , 2))
  from public.comprobante_proveedor c
  join public.nota_credito_proveedor n on n.id_comprobante = c.id_comprobante
  join public.tipo_comprobante tc on tc.id_tipo_comprobante = c.id_tipo_comprobante
  where c.id_comprobante = p_id_comprobante
    and c.anulado = false
    and tc.clase = 'nota_credito';
$$;

create or replace function public.fn_nota_credito_disponible_listar(
  p_id_proveedor uuid,
  p_excluir_orden uuid default null
)
returns table (
  id_comprobante uuid,
  numero_formateado text,
  fecha_comprobante date,
  importe_total numeric,
  disponible numeric
)
language sql
stable
set search_path to 'public'
as $$
  select
    c.id_comprobante,
    lpad(c.punto_venta::text, 5, '0') || '-' || lpad(c.numero::text, 8, '0'),
    c.fecha_comprobante,
    c.importe_total,
    public.fn_nota_credito_disponible(c.id_comprobante, p_excluir_orden)
  from public.comprobante_proveedor c
  join public.tipo_comprobante tc on tc.id_tipo_comprobante = c.id_tipo_comprobante
  where c.id_proveedor = p_id_proveedor
    and c.anulado = false
    and tc.clase = 'nota_credito'
    and public.fn_nota_credito_disponible(c.id_comprobante, p_excluir_orden) > 0
  order by c.fecha_comprobante, c.numero;
$$;

create or replace function public.fn_orden_pago_notas_listar(p_id_orden_pago uuid)
returns table (
  id_comprobante uuid,
  numero_formateado text,
  importe numeric
)
language sql
stable
set search_path to 'public'
as $$
  select
    r.id_comprobante,
    lpad(c.punto_venta::text, 5, '0') || '-' || lpad(c.numero::text, 8, '0'),
    r.importe
  from public.orden_pago_nota_credito r
  join public.comprobante_proveedor c on c.id_comprobante = r.id_comprobante
  where r.id_orden_pago = p_id_orden_pago
  order by c.fecha_comprobante, c.numero;
$$;

create or replace function public.fn_pago_notas_listar(p_id_pago uuid)
returns table (
  id_comprobante uuid,
  numero_formateado text,
  importe numeric
)
language sql
stable
set search_path to 'public'
as $$
  select
    r.id_comprobante,
    lpad(c.punto_venta::text, 5, '0') || '-' || lpad(c.numero::text, 8, '0'),
    r.importe
  from public.pago_nota_credito r
  join public.comprobante_proveedor c on c.id_comprobante = r.id_comprobante
  where r.id_pago = p_id_pago
  order by c.fecha_comprobante, c.numero;
$$;

create or replace function public.fn_orden_pago_validar_notas(p_id_orden_pago uuid)
returns void
language plpgsql
set search_path to 'public'
as $$
declare
  r record;
  v_disp numeric;
  v_suma numeric := 0;
  v_favor numeric;
begin
  select coalesce(importe_saldo_favor, 0) into v_favor
  from public.orden_pago where id_orden_pago = p_id_orden_pago;

  for r in
    select id_comprobante, importe
    from public.orden_pago_nota_credito
    where id_orden_pago = p_id_orden_pago
  loop
    v_disp := public.fn_nota_credito_disponible(r.id_comprobante, p_id_orden_pago);
    if round(r.importe, 2) > round(coalesce(v_disp, 0), 2) then
      raise exception 'Una nota de credito ya no tiene saldo suficiente' using errcode = 'OPG05';
    end if;
    v_suma := v_suma + r.importe;
  end loop;

  if round(v_suma, 2) <> round(coalesce(v_favor, 0), 2) then
    raise exception 'Las notas de credito no coinciden con el importe guardado' using errcode = 'OPG05';
  end if;
end;
$$;

create or replace function public.fn_orden_pago_aplicar_detalle(
  p_id_orden_pago uuid,
  p_id_proveedor uuid,
  p_imputaciones jsonb,
  p_medios jsonb,
  p_medios_opcionales boolean
)
returns void
language plpgsql
set search_path to 'public'
as $function$
declare
  r                record;
  v_comp           public.comprobante_proveedor;
  v_activo         boolean;
  v_suma_imputada  numeric(16,2);
  v_suma_medios    numeric(16,2) := 0;
  v_hay_medios     boolean;
  v_favor          numeric(16,2) := 0;
  v_disp           numeric(16,2);
  v_medios         jsonb := '[]'::jsonb;
  v_notas          jsonb := '[]'::jsonb;
begin
  if p_imputaciones is null
     or jsonb_typeof(p_imputaciones) <> 'array'
     or jsonb_array_length(p_imputaciones) = 0 then
    raise exception 'La orden debe imputar al menos un comprobante' using errcode = 'OPG03';
  end if;

  if (
    select count(distinct (e.value->>'id_comprobante'))
    from jsonb_array_elements(p_imputaciones) as e(value)
  ) <> jsonb_array_length(p_imputaciones) then
    raise exception 'Hay comprobantes repetidos en la orden' using errcode = 'OPG03';
  end if;

  for r in
    select (e.value->>'id_comprobante')::uuid as id_comprobante,
           (e.value->>'importe_imputado')::numeric as importe_imputado
    from jsonb_array_elements(p_imputaciones) as e(value)
  loop
    select * into v_comp
    from public.comprobante_proveedor
    where id_comprobante = r.id_comprobante;

    if v_comp.id_comprobante is null then
      raise exception 'Uno de los comprobantes de la orden no existe' using errcode = 'OPG03';
    end if;
    if v_comp.id_proveedor <> p_id_proveedor then
      raise exception 'Todos los comprobantes de la orden deben ser del mismo proveedor' using errcode = 'OPG02';
    end if;
    if v_comp.anulado or v_comp.saldo_pendiente <= 0 or v_comp.estado = 'Pagado' then
      raise exception 'Uno de los comprobantes esta anulado o no tiene saldo pendiente' using errcode = 'OPG03';
    end if;
    if r.importe_imputado is null or r.importe_imputado <= 0 then
      raise exception 'El importe imputado a cada comprobante debe ser mayor a cero' using errcode = 'OPG04';
    end if;
    if round(r.importe_imputado, 2) > round(v_comp.saldo_pendiente, 2) then
      raise exception 'No se puede imputar % a un comprobante con saldo %',
        to_char(round(r.importe_imputado, 2), 'FM999999999990.00'),
        to_char(round(v_comp.saldo_pendiente, 2), 'FM999999999990.00')
        using errcode = 'OPG04';
    end if;
  end loop;

  select coalesce(sum((e.value->>'importe_imputado')::numeric), 0)
    into v_suma_imputada
  from jsonb_array_elements(p_imputaciones) as e(value);

  if p_medios is not null and jsonb_typeof(p_medios) = 'array' then
    select coalesce(jsonb_agg(e.value), '[]'::jsonb) into v_notas
    from jsonb_array_elements(p_medios) e(value)
    where coalesce(e.value->>'id_medio_pago', '') = ''
      and e.value ? 'id_nota_credito';

    select coalesce(jsonb_agg(e.value), '[]'::jsonb) into v_medios
    from jsonb_array_elements(p_medios) e(value)
    where coalesce(e.value->>'id_medio_pago', '') <> '';
  end if;

  if (
    select count(*) from jsonb_array_elements(v_notas) e(value)
  ) <> (
    select count(distinct (e.value->>'id_nota_credito'))
    from jsonb_array_elements(v_notas) e(value)
  ) then
    raise exception 'Hay notas de credito repetidas en la orden' using errcode = 'OPG05';
  end if;

  for r in
    select (e.value->>'id_nota_credito')::uuid as id_nota,
           (e.value->>'importe')::numeric as importe
    from jsonb_array_elements(v_notas) e(value)
  loop
    if r.importe is null or r.importe <= 0 then
      raise exception 'El importe de cada nota de credito debe ser mayor a cero' using errcode = 'OPG05';
    end if;

    select c.* into v_comp
    from public.comprobante_proveedor c
    join public.tipo_comprobante tc on tc.id_tipo_comprobante = c.id_tipo_comprobante
    where c.id_comprobante = r.id_nota
      and c.id_proveedor = p_id_proveedor
      and c.anulado = false
      and tc.clase = 'nota_credito';

    if not found then
      raise exception 'La nota de credito no existe o no es de este proveedor' using errcode = 'OPG05';
    end if;

    v_disp := public.fn_nota_credito_disponible(r.id_nota, p_id_orden_pago);
    if round(r.importe, 2) > round(coalesce(v_disp, 0), 2) then
      raise exception 'La nota de credito no tiene tanto saldo sin aplicar' using errcode = 'OPG05';
    end if;

    v_favor := v_favor + round(r.importe, 2);
  end loop;

  v_favor := round(v_favor, 2);
  if v_favor > round(v_suma_imputada, 2) then
    raise exception 'Las notas de credito no pueden superar lo imputado' using errcode = 'OPG05';
  end if;

  v_hay_medios := jsonb_array_length(v_medios) > 0;

  if not v_hay_medios and not p_medios_opcionales and v_favor < round(v_suma_imputada, 2) then
    raise exception 'Indica al menos un medio de pago para confirmar la orden' using errcode = 'OPG05';
  end if;

  if v_hay_medios then
    for r in
      select (e.value->>'id_medio_pago')::uuid as id_medio_pago,
             (e.value->>'id_cuenta_tesoreria')::uuid as id_cuenta_tesoreria,
             (e.value->>'importe')::numeric as importe
      from jsonb_array_elements(v_medios) as e(value)
    loop
      if r.importe is null or r.importe <= 0 then
        raise exception 'El importe de cada medio de pago debe ser mayor a cero' using errcode = 'OPG05';
      end if;

      select activo into v_activo from public.medio_pago where id_medio_pago = r.id_medio_pago;
      if v_activo is null then
        raise exception 'Uno de los medios de pago no existe' using errcode = 'OPG07';
      end if;
      if v_activo = false then
        raise exception 'Uno de los medios de pago esta inactivo' using errcode = 'OPG07';
      end if;

      select activo into v_activo from public.cuenta_tesoreria where id_cuenta = r.id_cuenta_tesoreria;
      if v_activo is null then
        raise exception 'Una de las cuentas de tesoreria no existe' using errcode = 'OPG07';
      end if;
      if v_activo = false then
        raise exception 'Una de las cuentas de tesoreria esta inactiva' using errcode = 'OPG07';
      end if;

      if not exists (
        select 1 from public.medio_pago_cuenta
        where id_medio_pago = r.id_medio_pago
          and id_cuenta_tesoreria = r.id_cuenta_tesoreria
      ) then
        raise exception 'La cuenta elegida no esta habilitada para ese medio de pago' using errcode = 'OPG06';
      end if;
    end loop;

    select coalesce(sum((e.value->>'importe')::numeric), 0)
      into v_suma_medios
    from jsonb_array_elements(v_medios) as e(value);
  end if;

  if (v_hay_medios or v_favor > 0)
     and round(v_suma_medios + v_favor, 2) <> round(v_suma_imputada, 2) then
    raise exception 'La suma de los medios (%) mas las notas de credito (%) no coincide con lo imputado (%)',
      to_char(round(v_suma_medios, 2), 'FM999999999990.00'),
      to_char(v_favor, 'FM999999999990.00'),
      to_char(round(v_suma_imputada, 2), 'FM999999999990.00')
      using errcode = 'OPG05';
  end if;

  delete from public.orden_pago_comprobante where id_orden_pago = p_id_orden_pago;
  delete from public.orden_pago_medio where id_orden_pago = p_id_orden_pago;
  delete from public.orden_pago_nota_credito where id_orden_pago = p_id_orden_pago;

  insert into public.orden_pago_comprobante (id_orden_pago, id_comprobante, importe_imputado)
  select p_id_orden_pago,
         (e.value->>'id_comprobante')::uuid,
         round((e.value->>'importe_imputado')::numeric, 2)
  from jsonb_array_elements(p_imputaciones) as e(value);

  if v_hay_medios then
    insert into public.orden_pago_medio (
      id_orden_pago, id_medio_pago, id_cuenta_tesoreria, importe, referencia
    )
    select p_id_orden_pago,
           (e.value->>'id_medio_pago')::uuid,
           (e.value->>'id_cuenta_tesoreria')::uuid,
           round((e.value->>'importe')::numeric, 2),
           nullif(btrim(e.value->>'referencia'), '')
    from jsonb_array_elements(v_medios) as e(value);
  end if;

  insert into public.orden_pago_nota_credito (id_orden_pago, id_comprobante, importe)
  select p_id_orden_pago,
         (e.value->>'id_nota_credito')::uuid,
         round((e.value->>'importe')::numeric, 2)
  from jsonb_array_elements(v_notas) as e(value)
  where round((e.value->>'importe')::numeric, 2) > 0;

  update public.orden_pago
  set importe_total = round(v_suma_imputada, 2),
      importe_saldo_favor = v_favor
  where id_orden_pago = p_id_orden_pago;
end;
$function$;

create or replace function public.fn_orden_pago_confirmar(p_id_orden_pago uuid)
returns public.orden_pago
language plpgsql
set search_path to 'public'
as $function$
declare
  v_orden          public.orden_pago;
  v_suma_imputada  numeric(16,2);
  v_suma_medios    numeric(16,2);
  v_cant_medios    integer;
  r                record;
  v_comp           public.comprobante_proveedor;
begin
  select * into v_orden from public.orden_pago where id_orden_pago = p_id_orden_pago;
  if v_orden.id_orden_pago is null then
    raise exception 'La orden de pago indicada no existe' using errcode = 'OPG08';
  end if;
  if v_orden.estado <> 'Borrador' then
    raise exception 'Solo se puede confirmar una orden en estado Borrador' using errcode = 'OPG09';
  end if;

  for r in
    select opc.id_comprobante, opc.importe_imputado
    from public.orden_pago_comprobante opc
    where opc.id_orden_pago = p_id_orden_pago
  loop
    select * into v_comp
    from public.comprobante_proveedor where id_comprobante = r.id_comprobante;
    if v_comp.anulado or v_comp.saldo_pendiente <= 0 or v_comp.estado = 'Pagado' then
      raise exception 'Un comprobante de la orden se anulo o quedo sin saldo. Revisa el borrador.' using errcode = 'OPG03';
    end if;
    if round(r.importe_imputado, 2) > round(v_comp.saldo_pendiente, 2) then
      raise exception 'Un importe imputado supera el saldo actual del comprobante. Revisa el borrador.' using errcode = 'OPG04';
    end if;
  end loop;

  select coalesce(sum(importe_imputado), 0) into v_suma_imputada
  from public.orden_pago_comprobante where id_orden_pago = p_id_orden_pago;

  select count(*), coalesce(sum(importe), 0) into v_cant_medios, v_suma_medios
  from public.orden_pago_medio where id_orden_pago = p_id_orden_pago;

  if v_cant_medios = 0 and round(coalesce(v_orden.importe_saldo_favor, 0), 2) < round(v_suma_imputada, 2) then
    raise exception 'La orden no tiene medios de pago cargados' using errcode = 'OPG05';
  end if;
  if round(v_suma_medios + coalesce(v_orden.importe_saldo_favor, 0), 2) <> round(v_suma_imputada, 2) then
    raise exception 'La suma de los medios (%) mas las notas de credito (%) no coincide con lo imputado (%)',
      to_char(round(v_suma_medios, 2), 'FM999999999990.00'),
      to_char(round(coalesce(v_orden.importe_saldo_favor, 0), 2), 'FM999999999990.00'),
      to_char(round(v_suma_imputada, 2), 'FM999999999990.00')
      using errcode = 'OPG05';
  end if;

  perform public.fn_orden_pago_validar_notas(p_id_orden_pago);

  update public.orden_pago set estado = 'Pendiente de pago'
  where id_orden_pago = p_id_orden_pago
  returning * into v_orden;

  for r in
    select id_comprobante from public.orden_pago_comprobante
    where id_orden_pago = p_id_orden_pago
  loop
    perform public.fn_comprobante_recalcular_estado(r.id_comprobante);
  end loop;

  return v_orden;
end;
$function$;

revoke execute on function public.fn_nota_credito_disponible(uuid, uuid) from public, anon;
revoke execute on function public.fn_nota_credito_disponible_listar(uuid, uuid) from public, anon;
revoke execute on function public.fn_orden_pago_notas_listar(uuid) from public, anon;
revoke execute on function public.fn_pago_notas_listar(uuid) from public, anon;
revoke execute on function public.fn_orden_pago_validar_notas(uuid) from public, anon;
grant execute on function public.fn_nota_credito_disponible(uuid, uuid) to authenticated, service_role;
grant execute on function public.fn_nota_credito_disponible_listar(uuid, uuid) to authenticated, service_role;
grant execute on function public.fn_orden_pago_notas_listar(uuid) to authenticated, service_role;
grant execute on function public.fn_pago_notas_listar(uuid) to authenticated, service_role;
grant execute on function public.fn_orden_pago_validar_notas(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
