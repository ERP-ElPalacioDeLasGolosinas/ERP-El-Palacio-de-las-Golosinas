-- S5-16b · Registro simple del cliente web.
-- El alta web pide solo nombre + mail + contraseña; documento y teléfono se completan después
-- (en el checkout) y se exigen recién al registrar el pedido.
--
-- 1. cliente_obligatorios_chk: documento/teléfono siguen obligatorios para clientes cargados por el
--    ERP; los clientes web (id_usuario not null) pueden tenerlos en NULL hasta completarlos.
-- 2. fn_cliente_web_registrar: documento/teléfono opcionales (formato validado solo si vienen).
-- 3. fn_cliente_web_completar_datos: completa documento/teléfono (y dirección) del cliente de la sesión.
-- 4. fn_pedido_web_registrar: exige documento y teléfono cargados (PWB11).
-- Errcodes nuevos: CLW08 (sin cliente web en la sesión), PWB11 (datos del cliente incompletos).

alter table public.cliente drop constraint cliente_obligatorios_chk;
alter table public.cliente add constraint cliente_obligatorios_chk
  check (es_consumidor_final or id_usuario is not null
         or (documento_cliente is not null and telefono_cliente is not null));

create or replace function public.fn_cliente_web_registrar(
  p_nombre_cliente text,
  p_documento_cliente text default null,
  p_telefono_cliente text default null,
  p_direccion_cliente text default null
) returns public.cliente
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid       uuid := auth.uid();
  v_nombre    text := btrim(p_nombre_cliente);
  v_documento text := nullif(btrim(p_documento_cliente), '');
  v_telefono  text := nullif(btrim(p_telefono_cliente), '');
  v_direccion text := nullif(btrim(p_direccion_cliente), '');
  v_mail      text;
  v_tipo      uuid;
  v_cliente   public.cliente;
begin
  if v_uid is null then
    raise exception 'Debe iniciar sesión para registrarse' using errcode = 'CLW04';
  end if;
  if exists (select 1 from public.usuario where id_usuario = v_uid) then
    raise exception 'Una cuenta del ERP no puede registrarse como cliente web' using errcode = 'CLW04';
  end if;
  if exists (select 1 from public.cliente where id_usuario = v_uid) then
    raise exception 'Esta cuenta ya está registrada como cliente' using errcode = 'CLW04';
  end if;

  if v_nombre is null or length(v_nombre) = 0 then
    raise exception 'El nombre no puede estar vacío' using errcode = 'CLW01';
  end if;
  if v_documento is not null
     and v_documento !~ '^[0-9]{7,8}$' and v_documento !~ '^[0-9]{2}-[0-9]{8}-[0-9]{1}$' then
    raise exception 'El documento debe ser un DNI (7 u 8 dígitos) o un CUIT con formato XX-XXXXXXXX-X'
      using errcode = 'CLW02';
  end if;
  if v_telefono is not null and v_telefono !~ '^[0-9]{6,15}$' then
    raise exception 'El teléfono debe tener entre 6 y 15 dígitos' using errcode = 'CLW03';
  end if;

  select email into v_mail from auth.users where id = v_uid;

  select id_tipo_cliente into v_tipo
  from public.tipo_cliente
  where nombre_tipo_cliente = 'Minorista' and activo = true;
  if v_tipo is null then
    raise exception 'No existe el tipo de cliente Minorista activo' using errcode = 'CLW07';
  end if;

  begin
    insert into public.cliente (
      nombre_cliente, id_tipo_cliente, documento_cliente, telefono_cliente,
      mail_cliente, direccion_cliente, creado_por, id_usuario
    ) values (
      v_nombre, v_tipo, v_documento, v_telefono, v_mail, v_direccion, null, v_uid
    ) returning * into v_cliente;
  exception
    when unique_violation then
      raise exception 'Ya existe un cliente con ese documento' using errcode = 'CLW05';
    when check_violation then
      raise exception 'El mail de la cuenta no es válido para registrarse' using errcode = 'CLW06';
  end;

  return v_cliente;
end;
$function$;

create or replace function public.fn_cliente_web_completar_datos(
  p_documento_cliente text,
  p_telefono_cliente text,
  p_direccion_cliente text default null
) returns public.cliente
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id_cliente uuid;
  v_documento  text := nullif(btrim(p_documento_cliente), '');
  v_telefono   text := nullif(btrim(p_telefono_cliente), '');
  v_direccion  text := nullif(btrim(p_direccion_cliente), '');
  v_cliente    public.cliente;
begin
  select c.id_cliente into v_id_cliente
  from public.cliente c
  where c.id_usuario = auth.uid() and c.activo = true;
  if v_id_cliente is null then
    raise exception 'No hay un cliente web activo para esta sesión' using errcode = 'CLW08';
  end if;

  if v_documento is null
     or (v_documento !~ '^[0-9]{7,8}$' and v_documento !~ '^[0-9]{2}-[0-9]{8}-[0-9]{1}$') then
    raise exception 'El documento debe ser un DNI (7 u 8 dígitos) o un CUIT con formato XX-XXXXXXXX-X'
      using errcode = 'CLW02';
  end if;
  if v_telefono is null or v_telefono !~ '^[0-9]{6,15}$' then
    raise exception 'El teléfono debe tener entre 6 y 15 dígitos' using errcode = 'CLW03';
  end if;

  begin
    update public.cliente
    set documento_cliente = v_documento,
        telefono_cliente  = v_telefono,
        direccion_cliente = coalesce(v_direccion, direccion_cliente),
        editado = now()
    where id_cliente = v_id_cliente
    returning * into v_cliente;
  exception
    when unique_violation then
      raise exception 'Ya existe un cliente con ese documento' using errcode = 'CLW05';
  end;

  return v_cliente;
end;
$function$;

revoke all on function public.fn_cliente_web_completar_datos(text, text, text) from public, anon;
grant execute on function public.fn_cliente_web_completar_datos(text, text, text) to authenticated;

create or replace function public.fn_pedido_web_registrar(p_items jsonb, p_medio text)
returns table(id_pedido uuid, numero integer, importe_total numeric)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id_cliente uuid;
  v_documento text;
  v_telefono text;
  v_id_medio uuid;
  v_id_pedido uuid;
  v_numero integer;
  v_total numeric(14,2);
  v_malas text;
  v_lineas jsonb;
begin
  select c.id_cliente, c.documento_cliente, c.telefono_cliente
    into v_id_cliente, v_documento, v_telefono
  from public.cliente c
  where c.id_usuario = auth.uid() and c.activo = true;
  if v_id_cliente is null then
    raise exception 'No hay un cliente web activo para esta sesion' using errcode = 'PWB01';
  end if;
  if v_documento is null or v_telefono is null then
    raise exception 'Faltan el documento o el telefono del cliente' using errcode = 'PWB11';
  end if;

  if p_medio is distinct from 'Transferencia' then
    raise exception 'Medio de pago no disponible' using errcode = 'PWB02';
  end if;
  select mp.id_medio_pago into v_id_medio
  from public.medio_pago mp
  where mp.tipo::text = 'Transferencia' and mp.activo
  order by mp.nombre_medio_pago
  limit 1;
  if v_id_medio is null then
    raise exception 'Medio de pago no disponible' using errcode = 'PWB02';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id_producto', v.id_producto, 'cantidad', v.cantidad_solicitada,
           'precio', v.precio, 'estado', v.estado)), '[]'::jsonb)
    into v_lineas
  from public.fn_tienda_carrito_validar(p_items) v;

  if jsonb_array_length(v_lineas) = 0 then
    raise exception 'El carrito esta vacio' using errcode = 'PWB03';
  end if;

  select string_agg(l.id_producto || ':' || l.estado, ', ') into v_malas
  from jsonb_to_recordset(v_lineas) as l(id_producto uuid, cantidad numeric, precio numeric, estado text)
  where l.estado <> 'ok';
  if v_malas is not null then
    raise exception 'Hay articulos sin stock o no disponibles' using errcode = 'PWB04', detail = v_malas;
  end if;

  select sum(round(l.cantidad * l.precio, 2)) into v_total
  from jsonb_to_recordset(v_lineas) as l(id_producto uuid, cantidad numeric, precio numeric, estado text);

  insert into public.pedido_web (id_cliente, id_medio_pago, subtotal, importe_total)
  values (v_id_cliente, v_id_medio, v_total, v_total)
  returning pedido_web.id_pedido, pedido_web.numero into v_id_pedido, v_numero;

  insert into public.pedido_web_detalle (id_pedido, nro_linea, id_producto, cantidad, precio_unitario)
  select v_id_pedido, row_number() over (order by l.id_producto), l.id_producto, l.cantidad, l.precio
  from jsonb_to_recordset(v_lineas) as l(id_producto uuid, cantidad numeric, precio numeric, estado text);

  return query select v_id_pedido, v_numero, v_total;
end;
$function$;
