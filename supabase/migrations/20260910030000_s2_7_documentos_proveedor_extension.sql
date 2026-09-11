-- =====================================================================
-- S2-7 paso 3 | Tablas de extension por clase + funciones de alta (D-022)
-- Sprint 2 - ERP El Palacio de las Golosinas
--
-- Estado: aplicada en Supabase el 2026-09-10.
--
-- Cada documento de proveedor (factura / nota de debito / nota de
-- credito / remito) comparte la cabecera financiera comun
-- (comprobante_proveedor) y suma una tabla de extension 1:1 con su
-- detalle propio. El circuito de tesoreria e inventario NO se toca:
-- siguen apuntando a comprobante_proveedor.
--
--   (a) 3 tablas de extension + su detalle, con RLS authenticated
--       (mismo patron que comprobante_proveedor_detalle).
--   (b) comprobante_proveedor.importe_total: CHECK > 0 -> >= 0 (para
--       admitir remito con total 0). El CHECK calculado ya tolera 0.
--   (c) fn_comprobante_registrar: + guarda tipo.clase = 'factura' (CMP02).
--   (d) fn_comprobante_detalle_listar: despacha por clase; suma columnas
--       descripcion e id_detalle_origen (DROP + CREATE, re-GRANT).
--   (e) fn_nota_debito_registrar / fn_nota_credito_registrar /
--       fn_remito_registrar: alta transaccional (cabecera + extension +
--       detalle). Errcodes NDB* / NCR* / RMT*.
--   (f) fn_comprobante_facturas_asociables(p_id_proveedor): facturas del
--       proveedor no anuladas, para el selector de comprobante asociado.
--   (g) Guardas: recepcion de stock solo facturas; pendientes/resumen
--       excluyen nota_credito y remito.
--
-- Patron: SECURITY INVOKER salvo donde ya era DEFINER; GRANT EXECUTE a
-- anon/authenticated/service_role (identico al estado previo).
-- =====================================================================

-- (a) tablas de extension ---------------------------------------------

-- Nota de debito -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nota_debito_proveedor (
  id_comprobante          uuid PRIMARY KEY
                          REFERENCES public.comprobante_proveedor(id_comprobante) ON DELETE CASCADE,
  id_comprobante_asociado uuid
                          REFERENCES public.comprobante_proveedor(id_comprobante),
  motivo                  text NOT NULL
                          CHECK (motivo IN ('interes_mora','flete','diferencia_cambio','gasto_bancario','otro'))
);

CREATE TABLE IF NOT EXISTS public.nota_debito_proveedor_detalle (
  id_detalle     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_comprobante uuid NOT NULL
                 REFERENCES public.nota_debito_proveedor(id_comprobante) ON DELETE CASCADE,
  nro_linea      integer NOT NULL CHECK (nro_linea > 0),
  concepto       text NOT NULL CHECK (length(btrim(concepto)) > 0),
  importe        numeric(14,2) NOT NULL CHECK (importe >= 0),
  impuesto       numeric NOT NULL DEFAULT 0 CHECK (impuesto >= 0),
  importe_linea  numeric GENERATED ALWAYS AS (round(importe + impuesto, 2)) STORED,
  CONSTRAINT nota_debito_detalle_linea_unica UNIQUE (id_comprobante, nro_linea)
);

-- Nota de credito --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nota_credito_proveedor (
  id_comprobante          uuid PRIMARY KEY
                          REFERENCES public.comprobante_proveedor(id_comprobante) ON DELETE CASCADE,
  id_comprobante_asociado uuid NOT NULL
                          REFERENCES public.comprobante_proveedor(id_comprobante),
  motivo                  text NOT NULL
                          CHECK (motivo IN ('devolucion_mercaderia','bonificacion','error_facturacion','anulacion'))
);

CREATE TABLE IF NOT EXISTS public.nota_credito_proveedor_detalle (
  id_detalle        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_comprobante    uuid NOT NULL
                    REFERENCES public.nota_credito_proveedor(id_comprobante) ON DELETE CASCADE,
  nro_linea         integer NOT NULL CHECK (nro_linea > 0),
  id_producto       uuid REFERENCES public.producto(id_producto),
  id_detalle_origen uuid REFERENCES public.comprobante_proveedor_detalle(id_detalle),
  concepto          text,
  cantidad          numeric(14,3) CHECK (cantidad IS NULL OR cantidad > 0),
  precio_unitario   numeric(14,2) CHECK (precio_unitario IS NULL OR precio_unitario >= 0),
  impuesto          numeric NOT NULL DEFAULT 0 CHECK (impuesto >= 0),
  importe           numeric(14,2) NOT NULL CHECK (importe >= 0),
  CONSTRAINT nota_credito_detalle_linea_unica UNIQUE (id_comprobante, nro_linea),
  CONSTRAINT nota_credito_detalle_producto_o_concepto
    CHECK (id_producto IS NOT NULL
           OR (concepto IS NOT NULL AND length(btrim(concepto)) > 0))
);

-- Remito -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.remito_proveedor (
  id_comprobante          uuid PRIMARY KEY
                          REFERENCES public.comprobante_proveedor(id_comprobante) ON DELETE CASCADE,
  id_comprobante_asociado uuid
                          REFERENCES public.comprobante_proveedor(id_comprobante)
);

CREATE TABLE IF NOT EXISTS public.remito_proveedor_detalle (
  id_detalle     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_comprobante uuid NOT NULL
                 REFERENCES public.remito_proveedor(id_comprobante) ON DELETE CASCADE,
  nro_linea      integer NOT NULL CHECK (nro_linea > 0),
  id_producto    uuid NOT NULL REFERENCES public.producto(id_producto),
  cantidad       numeric(14,3) NOT NULL CHECK (cantidad > 0),
  CONSTRAINT remito_detalle_linea_unica UNIQUE (id_comprobante, nro_linea)
);

-- RLS: mismo patron que comprobante_proveedor_detalle (authenticated, true)
DO $$
DECLARE
  v_tabla text;
BEGIN
  FOREACH v_tabla IN ARRAY ARRAY[
    'nota_debito_proveedor','nota_debito_proveedor_detalle',
    'nota_credito_proveedor','nota_credito_proveedor_detalle',
    'remito_proveedor','remito_proveedor_detalle'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_tabla);
    EXECUTE format($f$
      DROP POLICY IF EXISTS %1$I_select_authenticated ON public.%1$I;
      CREATE POLICY %1$I_select_authenticated ON public.%1$I
        FOR SELECT TO authenticated USING (true);
      DROP POLICY IF EXISTS %1$I_insert_authenticated ON public.%1$I;
      CREATE POLICY %1$I_insert_authenticated ON public.%1$I
        FOR INSERT TO authenticated WITH CHECK (true);
      DROP POLICY IF EXISTS %1$I_update_authenticated ON public.%1$I;
      CREATE POLICY %1$I_update_authenticated ON public.%1$I
        FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
      DROP POLICY IF EXISTS %1$I_delete_authenticated ON public.%1$I;
      CREATE POLICY %1$I_delete_authenticated ON public.%1$I
        FOR DELETE TO authenticated USING (true);
    $f$, v_tabla);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.nota_debito_proveedor, public.nota_debito_proveedor_detalle,
  public.nota_credito_proveedor, public.nota_credito_proveedor_detalle,
  public.remito_proveedor, public.remito_proveedor_detalle
  TO authenticated, service_role;

-- (b) relajar el CHECK de importe_total para admitir remito (total 0) --
ALTER TABLE public.comprobante_proveedor
  DROP CONSTRAINT IF EXISTS comprobante_proveedor_importe_total_check;
ALTER TABLE public.comprobante_proveedor
  ADD CONSTRAINT comprobante_proveedor_importe_total_check
  CHECK (importe_total >= 0);

-- (c) fn_comprobante_registrar: guarda clase = 'factura' -------------
CREATE OR REPLACE FUNCTION public.fn_comprobante_registrar(
  p_id_proveedor uuid,
  p_id_tipo_comprobante uuid,
  p_punto_venta integer,
  p_numero integer,
  p_fecha_comprobante date,
  p_fecha_vencimiento date,
  p_observaciones text,
  p_detalle jsonb,
  p_creado_por uuid
)
RETURNS comprobante_proveedor
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
declare
  v_comprobante     public.comprobante_proveedor;
  v_prov_activo     boolean;
  v_tipo            record;
  v_invalidas       integer;
  v_subtotal        numeric;
  v_descuento_total numeric;
  v_impuesto_total  numeric;
  v_importe_total   numeric;
begin
  select activo into v_prov_activo from public.proveedor where id_proveedor = p_id_proveedor;
  if v_prov_activo is null then
    raise exception 'El proveedor indicado no existe' using errcode = 'CMP01';
  end if;
  if v_prov_activo = false then
    raise exception 'El proveedor esta inactivo y no admite nuevos comprobantes' using errcode = 'CMP09';
  end if;

  select id_tipo_comprobante, aplica_compra, clase into v_tipo
  from public.tipo_comprobante where id_tipo_comprobante = p_id_tipo_comprobante;
  if v_tipo.id_tipo_comprobante is null then
    raise exception 'El tipo de comprobante indicado no existe' using errcode = 'CMP02';
  end if;
  if v_tipo.aplica_compra = false then
    raise exception 'El tipo de comprobante seleccionado no aplica a compras' using errcode = 'CMP02';
  end if;
  if v_tipo.clase <> 'factura' then
    raise exception 'El tipo de comprobante seleccionado no corresponde a una factura' using errcode = 'CMP02';
  end if;

  if p_punto_venta is null or p_punto_venta <= 0 or p_numero is null or p_numero <= 0 then
    raise exception 'El punto de venta y el numero deben ser mayores a cero' using errcode = 'CMP03';
  end if;

  if p_fecha_comprobante is null then
    raise exception 'La fecha del comprobante es obligatoria' using errcode = 'CMP06';
  end if;
  if p_fecha_vencimiento is not null and p_fecha_vencimiento < p_fecha_comprobante then
    raise exception 'El vencimiento no puede ser anterior a la fecha del comprobante' using errcode = 'CMP06';
  end if;

  if p_detalle is null or jsonb_typeof(p_detalle) <> 'array' or jsonb_array_length(p_detalle) = 0 then
    raise exception 'El comprobante debe tener al menos una linea de detalle' using errcode = 'CMP07';
  end if;

  select count(*) into v_invalidas
  from jsonb_array_elements(p_detalle) as e(value)
  where coalesce((e.value->>'cantidad')::numeric, 0) <= 0
     or coalesce((e.value->>'precio_unitario')::numeric, 0) < 0
     or coalesce((e.value->>'descuento')::numeric, 0) < 0
     or coalesce((e.value->>'impuesto')::numeric, 0) < 0
     or (nullif(e.value->>'id_producto', '') is null and coalesce(btrim(e.value->>'concepto'), '') = '');
  if v_invalidas > 0 then
    raise exception 'Hay lineas invalidas: cada linea necesita articulo o concepto, cantidad mayor a cero y montos no negativos' using errcode = 'CMP07';
  end if;

  select
    round(coalesce(sum((e.value->>'cantidad')::numeric * (e.value->>'precio_unitario')::numeric), 0), 2),
    round(coalesce(sum(coalesce((e.value->>'descuento')::numeric, 0)), 0), 2),
    round(coalesce(sum(coalesce((e.value->>'impuesto')::numeric, 0)), 0), 2)
  into v_subtotal, v_descuento_total, v_impuesto_total
  from jsonb_array_elements(p_detalle) as e(value);

  v_importe_total := round(v_subtotal - v_descuento_total + v_impuesto_total, 2);
  if v_importe_total <= 0 then
    raise exception 'El importe total del comprobante debe ser mayor a cero' using errcode = 'CMP05';
  end if;

  if exists (
    select 1 from public.comprobante_proveedor
    where id_proveedor = p_id_proveedor
      and id_tipo_comprobante = p_id_tipo_comprobante
      and punto_venta = p_punto_venta
      and numero = p_numero
  ) then
    raise exception 'Ya existe un comprobante de ese proveedor, tipo, punto de venta y numero' using errcode = 'CMP04';
  end if;

  begin
    insert into public.comprobante_proveedor (
      id_proveedor, id_tipo_comprobante, punto_venta, numero,
      fecha_comprobante, fecha_vencimiento,
      subtotal, descuento_total, impuesto_total, importe_total, saldo_pendiente,
      observaciones, estado, creado_por
    ) values (
      p_id_proveedor, p_id_tipo_comprobante, p_punto_venta, p_numero,
      p_fecha_comprobante, p_fecha_vencimiento,
      v_subtotal, v_descuento_total, v_impuesto_total, v_importe_total, v_importe_total,
      nullif(btrim(p_observaciones), ''), 'Pendiente', coalesce(p_creado_por, auth.uid())
    )
    returning * into v_comprobante;
  exception
    when unique_violation then
      raise exception 'Ya existe un comprobante de ese proveedor, tipo, punto de venta y numero' using errcode = 'CMP04';
  end;

  insert into public.comprobante_proveedor_detalle (
    id_comprobante, nro_linea, id_producto, concepto, cantidad, precio_unitario, descuento, impuesto
  )
  select
    v_comprobante.id_comprobante,
    e.ord::integer,
    nullif(e.value->>'id_producto', '')::uuid,
    nullif(btrim(e.value->>'concepto'), ''),
    (e.value->>'cantidad')::numeric,
    (e.value->>'precio_unitario')::numeric,
    coalesce((e.value->>'descuento')::numeric, 0),
    coalesce((e.value->>'impuesto')::numeric, 0)
  from jsonb_array_elements(p_detalle) with ordinality as e(value, ord);

  return v_comprobante;
end;
$function$;

-- (d) fn_comprobante_detalle_listar: despacho por clase --------------
-- Cambia el RETURNS TABLE (suma descripcion e id_detalle_origen), asi
-- que hay DROP + CREATE + re-GRANT. La factura mantiene todas las
-- columnas previas con los mismos valores.
DROP FUNCTION IF EXISTS public.fn_comprobante_detalle_listar(uuid);

CREATE FUNCTION public.fn_comprobante_detalle_listar(p_id_comprobante uuid)
RETURNS TABLE(
  id_detalle uuid,
  nro_linea integer,
  id_producto uuid,
  nombre_producto text,
  concepto text,
  cantidad numeric,
  precio_unitario numeric,
  descuento numeric,
  impuesto numeric,
  importe_linea numeric,
  descripcion text,
  id_detalle_origen uuid
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
declare
  v_clase text;
begin
  select tc.clase into v_clase
  from public.comprobante_proveedor c
  join public.tipo_comprobante tc on tc.id_tipo_comprobante = c.id_tipo_comprobante
  where c.id_comprobante = p_id_comprobante;

  if v_clase is null then
    return;
  end if;

  if v_clase = 'nota_debito' then
    return query
      select d.id_detalle, d.nro_linea,
             null::uuid, null::text,
             d.concepto, null::numeric, null::numeric, 0::numeric,
             d.impuesto, d.importe_linea,
             d.concepto, null::uuid
      from public.nota_debito_proveedor_detalle d
      where d.id_comprobante = p_id_comprobante
      order by d.nro_linea;

  elsif v_clase = 'nota_credito' then
    return query
      select d.id_detalle, d.nro_linea,
             d.id_producto, pr.nombre_producto::text,
             d.concepto, d.cantidad, d.precio_unitario, 0::numeric,
             d.impuesto, round(d.importe, 2),
             coalesce(pr.nombre_producto::text, d.concepto), d.id_detalle_origen
      from public.nota_credito_proveedor_detalle d
      left join public.producto pr on pr.id_producto = d.id_producto
      where d.id_comprobante = p_id_comprobante
      order by d.nro_linea;

  elsif v_clase = 'remito' then
    return query
      select d.id_detalle, d.nro_linea,
             d.id_producto, pr.nombre_producto::text,
             null::text, d.cantidad, null::numeric, null::numeric,
             null::numeric, null::numeric,
             pr.nombre_producto::text, null::uuid
      from public.remito_proveedor_detalle d
      join public.producto pr on pr.id_producto = d.id_producto
      where d.id_comprobante = p_id_comprobante
      order by d.nro_linea;

  else
    return query
      select det.id_detalle, det.nro_linea,
             det.id_producto, pr.nombre_producto::text,
             det.concepto, det.cantidad, det.precio_unitario, det.descuento,
             det.impuesto, det.importe_linea,
             coalesce(pr.nombre_producto::text, det.concepto), null::uuid
      from public.comprobante_proveedor_detalle det
      left join public.producto pr on pr.id_producto = det.id_producto
      where det.id_comprobante = p_id_comprobante
      order by det.nro_linea;
  end if;
end;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_comprobante_detalle_listar(uuid)
  TO anon, authenticated, service_role;

-- (e) funciones de alta por clase -----------------------------------

-- Nota de debito ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_nota_debito_registrar(
  p_id_proveedor uuid,
  p_id_tipo_comprobante uuid,
  p_punto_venta integer,
  p_numero integer,
  p_fecha_comprobante date,
  p_id_comprobante_asociado uuid,
  p_motivo text,
  p_observaciones text,
  p_detalle jsonb,
  p_creado_por uuid
)
RETURNS comprobante_proveedor
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
declare
  v_comprobante    public.comprobante_proveedor;
  v_prov_activo    boolean;
  v_tipo           record;
  v_motivo         text := lower(btrim(coalesce(p_motivo, '')));
  v_asoc           record;
  v_invalidas      integer;
  v_subtotal       numeric;
  v_impuesto_total numeric;
  v_importe_total  numeric;
begin
  select activo into v_prov_activo from public.proveedor where id_proveedor = p_id_proveedor;
  if v_prov_activo is null then
    raise exception 'El proveedor indicado no existe' using errcode = 'NDB01';
  end if;
  if v_prov_activo = false then
    raise exception 'El proveedor esta inactivo y no admite nuevos comprobantes' using errcode = 'NDB02';
  end if;

  select id_tipo_comprobante, aplica_compra, clase into v_tipo
  from public.tipo_comprobante where id_tipo_comprobante = p_id_tipo_comprobante;
  if v_tipo.id_tipo_comprobante is null then
    raise exception 'El tipo de comprobante indicado no existe' using errcode = 'NDB03';
  end if;
  if v_tipo.aplica_compra = false then
    raise exception 'El tipo de comprobante seleccionado no aplica a compras' using errcode = 'NDB03';
  end if;
  if v_tipo.clase <> 'nota_debito' then
    raise exception 'El tipo de comprobante seleccionado no es una nota de debito' using errcode = 'NDB04';
  end if;

  if p_punto_venta is null or p_punto_venta <= 0 or p_numero is null or p_numero <= 0 then
    raise exception 'El punto de venta y el numero deben ser mayores a cero' using errcode = 'NDB05';
  end if;
  if p_fecha_comprobante is null then
    raise exception 'La fecha del comprobante es obligatoria' using errcode = 'NDB06';
  end if;

  if v_motivo not in ('interes_mora','flete','diferencia_cambio','gasto_bancario','otro') then
    raise exception 'El motivo de la nota de debito no es valido' using errcode = 'NDB07';
  end if;

  if p_id_comprobante_asociado is not null then
    select c.id_comprobante, c.id_proveedor, c.anulado, tc.clase into v_asoc
    from public.comprobante_proveedor c
    join public.tipo_comprobante tc on tc.id_tipo_comprobante = c.id_tipo_comprobante
    where c.id_comprobante = p_id_comprobante_asociado;
    if v_asoc.id_comprobante is null then
      raise exception 'El comprobante asociado indicado no existe' using errcode = 'NDB08';
    end if;
    if v_asoc.id_proveedor <> p_id_proveedor then
      raise exception 'El comprobante asociado pertenece a otro proveedor' using errcode = 'NDB08';
    end if;
    if v_asoc.clase <> 'factura' then
      raise exception 'El comprobante asociado debe ser una factura' using errcode = 'NDB08';
    end if;
    if v_asoc.anulado then
      raise exception 'El comprobante asociado esta anulado' using errcode = 'NDB08';
    end if;
  end if;

  if p_detalle is null or jsonb_typeof(p_detalle) <> 'array' or jsonb_array_length(p_detalle) = 0 then
    raise exception 'La nota de debito debe tener al menos una linea de detalle' using errcode = 'NDB09';
  end if;

  select count(*) into v_invalidas
  from jsonb_array_elements(p_detalle) as e(value)
  where coalesce(btrim(e.value->>'concepto'), '') = ''
     or coalesce((e.value->>'importe')::numeric, -1) < 0
     or coalesce((e.value->>'impuesto')::numeric, 0) < 0;
  if v_invalidas > 0 then
    raise exception 'Hay lineas invalidas: cada linea necesita concepto e importes no negativos' using errcode = 'NDB09';
  end if;

  select
    round(coalesce(sum((e.value->>'importe')::numeric), 0), 2),
    round(coalesce(sum(coalesce((e.value->>'impuesto')::numeric, 0)), 0), 2)
  into v_subtotal, v_impuesto_total
  from jsonb_array_elements(p_detalle) as e(value);

  v_importe_total := round(v_subtotal + v_impuesto_total, 2);
  if v_importe_total <= 0 then
    raise exception 'El importe total de la nota de debito debe ser mayor a cero' using errcode = 'NDB10';
  end if;

  if exists (
    select 1 from public.comprobante_proveedor
    where id_proveedor = p_id_proveedor
      and id_tipo_comprobante = p_id_tipo_comprobante
      and punto_venta = p_punto_venta
      and numero = p_numero
  ) then
    raise exception 'Ya existe un comprobante de ese proveedor, tipo, punto de venta y numero' using errcode = 'NDB11';
  end if;

  begin
    insert into public.comprobante_proveedor (
      id_proveedor, id_tipo_comprobante, punto_venta, numero,
      fecha_comprobante, fecha_vencimiento,
      subtotal, descuento_total, impuesto_total, importe_total, saldo_pendiente,
      observaciones, estado, creado_por
    ) values (
      p_id_proveedor, p_id_tipo_comprobante, p_punto_venta, p_numero,
      p_fecha_comprobante, null,
      v_subtotal, 0, v_impuesto_total, v_importe_total, v_importe_total,
      nullif(btrim(p_observaciones), ''), 'Pendiente', coalesce(p_creado_por, auth.uid())
    )
    returning * into v_comprobante;
  exception
    when unique_violation then
      raise exception 'Ya existe un comprobante de ese proveedor, tipo, punto de venta y numero' using errcode = 'NDB11';
  end;

  insert into public.nota_debito_proveedor (id_comprobante, id_comprobante_asociado, motivo)
  values (v_comprobante.id_comprobante, p_id_comprobante_asociado, v_motivo);

  insert into public.nota_debito_proveedor_detalle (
    id_comprobante, nro_linea, concepto, importe, impuesto
  )
  select
    v_comprobante.id_comprobante,
    e.ord::integer,
    btrim(e.value->>'concepto'),
    (e.value->>'importe')::numeric,
    coalesce((e.value->>'impuesto')::numeric, 0)
  from jsonb_array_elements(p_detalle) with ordinality as e(value, ord);

  return v_comprobante;
end;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_nota_debito_registrar(
  uuid, uuid, integer, integer, date, uuid, text, text, jsonb, uuid)
  TO anon, authenticated, service_role;

-- Nota de credito ------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_nota_credito_registrar(
  p_id_proveedor uuid,
  p_id_tipo_comprobante uuid,
  p_punto_venta integer,
  p_numero integer,
  p_fecha_comprobante date,
  p_id_comprobante_asociado uuid,
  p_motivo text,
  p_observaciones text,
  p_detalle jsonb,
  p_creado_por uuid
)
RETURNS comprobante_proveedor
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
declare
  v_comprobante    public.comprobante_proveedor;
  v_prov_activo    boolean;
  v_tipo           record;
  v_motivo         text := lower(btrim(coalesce(p_motivo, '')));
  v_asoc           record;
  v_es_devolucion  boolean;
  v_invalidas      integer;
  v_subtotal       numeric;
  v_impuesto_total numeric;
  v_importe_total  numeric;
begin
  select activo into v_prov_activo from public.proveedor where id_proveedor = p_id_proveedor;
  if v_prov_activo is null then
    raise exception 'El proveedor indicado no existe' using errcode = 'NCR01';
  end if;
  if v_prov_activo = false then
    raise exception 'El proveedor esta inactivo y no admite nuevos comprobantes' using errcode = 'NCR02';
  end if;

  select id_tipo_comprobante, aplica_compra, clase into v_tipo
  from public.tipo_comprobante where id_tipo_comprobante = p_id_tipo_comprobante;
  if v_tipo.id_tipo_comprobante is null then
    raise exception 'El tipo de comprobante indicado no existe' using errcode = 'NCR03';
  end if;
  if v_tipo.aplica_compra = false then
    raise exception 'El tipo de comprobante seleccionado no aplica a compras' using errcode = 'NCR03';
  end if;
  if v_tipo.clase <> 'nota_credito' then
    raise exception 'El tipo de comprobante seleccionado no es una nota de credito' using errcode = 'NCR04';
  end if;

  if p_punto_venta is null or p_punto_venta <= 0 or p_numero is null or p_numero <= 0 then
    raise exception 'El punto de venta y el numero deben ser mayores a cero' using errcode = 'NCR05';
  end if;
  if p_fecha_comprobante is null then
    raise exception 'La fecha del comprobante es obligatoria' using errcode = 'NCR06';
  end if;

  if v_motivo not in ('devolucion_mercaderia','bonificacion','error_facturacion','anulacion') then
    raise exception 'El motivo de la nota de credito no es valido' using errcode = 'NCR07';
  end if;
  v_es_devolucion := (v_motivo = 'devolucion_mercaderia');

  if p_id_comprobante_asociado is null then
    raise exception 'La nota de credito requiere una factura asociada' using errcode = 'NCR08';
  end if;
  select c.id_comprobante, c.id_proveedor, c.anulado, c.importe_total, tc.clase into v_asoc
  from public.comprobante_proveedor c
  join public.tipo_comprobante tc on tc.id_tipo_comprobante = c.id_tipo_comprobante
  where c.id_comprobante = p_id_comprobante_asociado;
  if v_asoc.id_comprobante is null then
    raise exception 'La factura asociada indicada no existe' using errcode = 'NCR08';
  end if;
  if v_asoc.id_proveedor <> p_id_proveedor then
    raise exception 'La factura asociada pertenece a otro proveedor' using errcode = 'NCR08';
  end if;
  if v_asoc.clase <> 'factura' then
    raise exception 'El comprobante asociado debe ser una factura' using errcode = 'NCR08';
  end if;
  if v_asoc.anulado then
    raise exception 'La factura asociada esta anulada' using errcode = 'NCR08';
  end if;

  if p_detalle is null or jsonb_typeof(p_detalle) <> 'array' or jsonb_array_length(p_detalle) = 0 then
    raise exception 'La nota de credito debe tener al menos una linea de detalle' using errcode = 'NCR09';
  end if;

  if v_es_devolucion then
    -- cada linea: producto + cantidad > 0 + precio >= 0 + id_detalle_origen
    select count(*) into v_invalidas
    from jsonb_array_elements(p_detalle) as e(value)
    where nullif(e.value->>'id_producto', '') is null
       or nullif(e.value->>'id_detalle_origen', '') is null
       or coalesce((e.value->>'cantidad')::numeric, 0) <= 0
       or coalesce((e.value->>'precio_unitario')::numeric, 0) < 0
       or coalesce((e.value->>'importe')::numeric, -1) < 0
       or coalesce((e.value->>'impuesto')::numeric, 0) < 0;
    if v_invalidas > 0 then
      raise exception 'En devolucion de mercaderia cada linea necesita producto, cantidad, precio y la linea de origen' using errcode = 'NCR09';
    end if;

    -- las lineas de origen deben pertenecer a la factura asociada
    select count(*) into v_invalidas
    from jsonb_array_elements(p_detalle) as e(value)
    where not exists (
      select 1 from public.comprobante_proveedor_detalle cd
      where cd.id_detalle = (e.value->>'id_detalle_origen')::uuid
        and cd.id_comprobante = p_id_comprobante_asociado
    );
    if v_invalidas > 0 then
      raise exception 'Alguna linea de origen no pertenece a la factura asociada' using errcode = 'NCR12';
    end if;

    -- tope por linea: la cantidad a acreditar no puede superar la de origen
    select count(*) into v_invalidas
    from jsonb_array_elements(p_detalle) as e(value)
    join public.comprobante_proveedor_detalle cd
      on cd.id_detalle = (e.value->>'id_detalle_origen')::uuid
    where (e.value->>'cantidad')::numeric > cd.cantidad;
    if v_invalidas > 0 then
      raise exception 'La cantidad a acreditar supera la cantidad de la linea de origen' using errcode = 'NCR12';
    end if;
  else
    -- bonificacion / error / anulacion: concepto + importe
    select count(*) into v_invalidas
    from jsonb_array_elements(p_detalle) as e(value)
    where coalesce(btrim(e.value->>'concepto'), '') = ''
       or coalesce((e.value->>'importe')::numeric, -1) < 0
       or coalesce((e.value->>'impuesto')::numeric, 0) < 0;
    if v_invalidas > 0 then
      raise exception 'Hay lineas invalidas: cada linea necesita concepto e importes no negativos' using errcode = 'NCR09';
    end if;
  end if;

  select
    round(coalesce(sum((e.value->>'importe')::numeric), 0), 2),
    round(coalesce(sum(coalesce((e.value->>'impuesto')::numeric, 0)), 0), 2)
  into v_importe_total, v_impuesto_total
  from jsonb_array_elements(p_detalle) as e(value);

  if v_importe_total <= 0 then
    raise exception 'El importe total de la nota de credito debe ser mayor a cero' using errcode = 'NCR10';
  end if;
  if v_importe_total > v_asoc.importe_total then
    raise exception 'El importe de la nota de credito no puede superar el total de la factura asociada' using errcode = 'NCR10';
  end if;
  v_subtotal := round(v_importe_total - v_impuesto_total, 2);

  if exists (
    select 1 from public.comprobante_proveedor
    where id_proveedor = p_id_proveedor
      and id_tipo_comprobante = p_id_tipo_comprobante
      and punto_venta = p_punto_venta
      and numero = p_numero
  ) then
    raise exception 'Ya existe un comprobante de ese proveedor, tipo, punto de venta y numero' using errcode = 'NCR11';
  end if;

  begin
    insert into public.comprobante_proveedor (
      id_proveedor, id_tipo_comprobante, punto_venta, numero,
      fecha_comprobante, fecha_vencimiento,
      subtotal, descuento_total, impuesto_total, importe_total, saldo_pendiente,
      observaciones, estado, creado_por
    ) values (
      p_id_proveedor, p_id_tipo_comprobante, p_punto_venta, p_numero,
      p_fecha_comprobante, null,
      v_subtotal, 0, v_impuesto_total, v_importe_total, 0,
      nullif(btrim(p_observaciones), ''), 'Pendiente', coalesce(p_creado_por, auth.uid())
    )
    returning * into v_comprobante;
  exception
    when unique_violation then
      raise exception 'Ya existe un comprobante de ese proveedor, tipo, punto de venta y numero' using errcode = 'NCR11';
  end;

  insert into public.nota_credito_proveedor (id_comprobante, id_comprobante_asociado, motivo)
  values (v_comprobante.id_comprobante, p_id_comprobante_asociado, v_motivo);

  insert into public.nota_credito_proveedor_detalle (
    id_comprobante, nro_linea, id_producto, id_detalle_origen,
    concepto, cantidad, precio_unitario, impuesto, importe
  )
  select
    v_comprobante.id_comprobante,
    e.ord::integer,
    nullif(e.value->>'id_producto', '')::uuid,
    nullif(e.value->>'id_detalle_origen', '')::uuid,
    nullif(btrim(e.value->>'concepto'), ''),
    nullif(e.value->>'cantidad', '')::numeric,
    nullif(e.value->>'precio_unitario', '')::numeric,
    coalesce((e.value->>'impuesto')::numeric, 0),
    (e.value->>'importe')::numeric
  from jsonb_array_elements(p_detalle) with ordinality as e(value, ord);

  return v_comprobante;
end;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_nota_credito_registrar(
  uuid, uuid, integer, integer, date, uuid, text, text, jsonb, uuid)
  TO anon, authenticated, service_role;

-- Remito -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_remito_registrar(
  p_id_proveedor uuid,
  p_id_tipo_comprobante uuid,
  p_punto_venta integer,
  p_numero integer,
  p_fecha_comprobante date,
  p_id_comprobante_asociado uuid,
  p_observaciones text,
  p_detalle jsonb,
  p_creado_por uuid
)
RETURNS comprobante_proveedor
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
declare
  v_comprobante public.comprobante_proveedor;
  v_prov_activo boolean;
  v_tipo        record;
  v_asoc        record;
  v_invalidas   integer;
begin
  select activo into v_prov_activo from public.proveedor where id_proveedor = p_id_proveedor;
  if v_prov_activo is null then
    raise exception 'El proveedor indicado no existe' using errcode = 'RMT01';
  end if;
  if v_prov_activo = false then
    raise exception 'El proveedor esta inactivo y no admite nuevos comprobantes' using errcode = 'RMT02';
  end if;

  select id_tipo_comprobante, aplica_compra, clase into v_tipo
  from public.tipo_comprobante where id_tipo_comprobante = p_id_tipo_comprobante;
  if v_tipo.id_tipo_comprobante is null then
    raise exception 'El tipo de comprobante indicado no existe' using errcode = 'RMT03';
  end if;
  if v_tipo.aplica_compra = false then
    raise exception 'El tipo de comprobante seleccionado no aplica a compras' using errcode = 'RMT03';
  end if;
  if v_tipo.clase <> 'remito' then
    raise exception 'El tipo de comprobante seleccionado no es un remito' using errcode = 'RMT04';
  end if;

  if p_punto_venta is null or p_punto_venta <= 0 or p_numero is null or p_numero <= 0 then
    raise exception 'El punto de venta y el numero deben ser mayores a cero' using errcode = 'RMT05';
  end if;
  if p_fecha_comprobante is null then
    raise exception 'La fecha del comprobante es obligatoria' using errcode = 'RMT06';
  end if;

  if p_id_comprobante_asociado is not null then
    select c.id_comprobante, c.id_proveedor, c.anulado, tc.clase into v_asoc
    from public.comprobante_proveedor c
    join public.tipo_comprobante tc on tc.id_tipo_comprobante = c.id_tipo_comprobante
    where c.id_comprobante = p_id_comprobante_asociado;
    if v_asoc.id_comprobante is null then
      raise exception 'El comprobante asociado indicado no existe' using errcode = 'RMT07';
    end if;
    if v_asoc.id_proveedor <> p_id_proveedor then
      raise exception 'El comprobante asociado pertenece a otro proveedor' using errcode = 'RMT07';
    end if;
    if v_asoc.clase <> 'factura' then
      raise exception 'El comprobante asociado debe ser una factura' using errcode = 'RMT07';
    end if;
    if v_asoc.anulado then
      raise exception 'El comprobante asociado esta anulado' using errcode = 'RMT07';
    end if;
  end if;

  if p_detalle is null or jsonb_typeof(p_detalle) <> 'array' or jsonb_array_length(p_detalle) = 0 then
    raise exception 'El remito debe tener al menos una linea de detalle' using errcode = 'RMT08';
  end if;

  select count(*) into v_invalidas
  from jsonb_array_elements(p_detalle) as e(value)
  where nullif(e.value->>'id_producto', '') is null
     or coalesce((e.value->>'cantidad')::numeric, 0) <= 0
     or not exists (
       select 1 from public.producto pr
       where pr.id_producto = (e.value->>'id_producto')::uuid
     );
  if v_invalidas > 0 then
    raise exception 'Hay lineas invalidas: cada linea necesita un producto valido y cantidad mayor a cero' using errcode = 'RMT08';
  end if;

  if exists (
    select 1 from public.comprobante_proveedor
    where id_proveedor = p_id_proveedor
      and id_tipo_comprobante = p_id_tipo_comprobante
      and punto_venta = p_punto_venta
      and numero = p_numero
  ) then
    raise exception 'Ya existe un comprobante de ese proveedor, tipo, punto de venta y numero' using errcode = 'RMT09';
  end if;

  begin
    insert into public.comprobante_proveedor (
      id_proveedor, id_tipo_comprobante, punto_venta, numero,
      fecha_comprobante, fecha_vencimiento,
      subtotal, descuento_total, impuesto_total, importe_total, saldo_pendiente,
      observaciones, estado, creado_por
    ) values (
      p_id_proveedor, p_id_tipo_comprobante, p_punto_venta, p_numero,
      p_fecha_comprobante, null,
      0, 0, 0, 0, 0,
      nullif(btrim(p_observaciones), ''), 'Pendiente', coalesce(p_creado_por, auth.uid())
    )
    returning * into v_comprobante;
  exception
    when unique_violation then
      raise exception 'Ya existe un comprobante de ese proveedor, tipo, punto de venta y numero' using errcode = 'RMT09';
  end;

  insert into public.remito_proveedor (id_comprobante, id_comprobante_asociado)
  values (v_comprobante.id_comprobante, p_id_comprobante_asociado);

  insert into public.remito_proveedor_detalle (
    id_comprobante, nro_linea, id_producto, cantidad
  )
  select
    v_comprobante.id_comprobante,
    e.ord::integer,
    (e.value->>'id_producto')::uuid,
    (e.value->>'cantidad')::numeric
  from jsonb_array_elements(p_detalle) with ordinality as e(value, ord);

  return v_comprobante;
end;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_remito_registrar(
  uuid, uuid, integer, integer, date, uuid, text, jsonb, uuid)
  TO anon, authenticated, service_role;

-- (f) fn_comprobante_facturas_asociables ----------------------------
CREATE OR REPLACE FUNCTION public.fn_comprobante_facturas_asociables(p_id_proveedor uuid)
RETURNS TABLE(
  id_comprobante uuid,
  id_tipo_comprobante uuid,
  nombre_tipo_comprobante text,
  letra character,
  punto_venta integer,
  numero integer,
  numero_formateado text,
  fecha_comprobante date,
  importe_total numeric,
  saldo_pendiente numeric,
  estado estado_comprobante_proveedor
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  select
    c.id_comprobante, c.id_tipo_comprobante, tc.nombre_tipo_comprobante, tc.letra,
    c.punto_venta, c.numero,
    lpad(c.punto_venta::text, 5, '0') || '-' || lpad(c.numero::text, 8, '0') as numero_formateado,
    c.fecha_comprobante, c.importe_total, c.saldo_pendiente, c.estado
  from public.comprobante_proveedor c
  join public.tipo_comprobante tc on tc.id_tipo_comprobante = c.id_tipo_comprobante
  where c.id_proveedor = p_id_proveedor
    and tc.clase = 'factura'
    and c.anulado = false
  order by c.fecha_comprobante desc, c.creado desc;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_comprobante_facturas_asociables(uuid)
  TO anon, authenticated, service_role;

-- (g) guardas por clase --------------------------------------------

-- recepcion de stock: solo facturas
CREATE OR REPLACE FUNCTION public.fn_comprobante_listar_para_recepcion()
RETURNS TABLE(id_comprobante uuid, id_proveedor uuid, nombre_proveedor text, numero_formateado text, fecha_comprobante date, importe_total numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select
    c.id_comprobante, c.id_proveedor, p.nombre_proveedor,
    lpad(c.punto_venta::text, 5, '0') || '-' || lpad(c.numero::text, 8, '0') as numero_formateado,
    c.fecha_comprobante, c.importe_total
  from public.comprobante_proveedor c
  join public.proveedor p on p.id_proveedor = c.id_proveedor
  join public.tipo_comprobante tc on tc.id_tipo_comprobante = c.id_tipo_comprobante
  where tc.aplica_compra = true
    and tc.clase = 'factura'
    and c.anulado = false
    and not exists (select 1 from public.inventario i where i.id_comprobante = c.id_comprobante)
  order by c.fecha_comprobante desc, c.creado desc;
$function$;

CREATE OR REPLACE FUNCTION public.fn_lote_registrar_desde_comprobante(
  p_id_comprobante uuid, p_id_deposito uuid, p_detalle_lote text, p_creado_por uuid, p_productos jsonb
)
RETURNS TABLE(lote_id uuid, id_comprobante uuid, movimientos jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_item          jsonb;
  v_id_lote       uuid;
  v_id_marca      uuid;
  v_anulado       boolean;
  v_aplica_compra boolean;
  v_clase         text;
  v_id_tipo_ingreso uuid;
  v_movimientos   jsonb := '[]'::jsonb;
  v_movimiento    public.movimiento_stock;
begin
  if p_productos is null or jsonb_array_length(p_productos) = 0 then
    raise exception 'Debe cargar al menos un producto para registrar el lote' using errcode = 'LOT01';
  end if;

  select c.anulado, tc.aplica_compra, tc.clase
    into v_anulado, v_aplica_compra, v_clase
  from public.comprobante_proveedor c
  join public.tipo_comprobante tc on tc.id_tipo_comprobante = c.id_tipo_comprobante
  where c.id_comprobante = p_id_comprobante
  for update of c;

  if not found then
    raise exception 'La factura indicada no existe' using errcode = 'LOT07';
  end if;
  if v_aplica_compra = false then
    raise exception 'El comprobante seleccionado no corresponde a una compra' using errcode = 'LOT09';
  end if;
  if v_clase <> 'factura' then
    raise exception 'Solo se puede recibir mercaderia contra una factura' using errcode = 'LOT09';
  end if;
  if v_anulado then
    raise exception 'La factura esta anulada; no admite recepcion de mercaderia' using errcode = 'LOT09';
  end if;
  if exists (select 1 from public.inventario i where i.id_comprobante = p_id_comprobante) then
    raise exception 'La factura ya tiene un lote de recepcion; edite el lote existente' using errcode = 'LOT08';
  end if;

  select tm.id_tipo_movimiento into v_id_tipo_ingreso
  from public.tipo_movimiento tm
  where tm.nombre = 'ingreso por compra' and tm.activo = true;
  if v_id_tipo_ingreso is null then
    raise exception 'No se encontro el tipo de movimiento "ingreso por compra" activo' using errcode = 'LOT06';
  end if;

  insert into public.inventario (id_comprobante, id_deposito, detalle_lote, creado_por)
  values (p_id_comprobante, p_id_deposito, nullif(btrim(p_detalle_lote), ''), coalesce(p_creado_por, auth.uid()))
  returning id_lote into v_id_lote;

  for v_item in select * from jsonb_array_elements(p_productos) loop
    select p.id_marca into v_id_marca
    from public.producto p where p.id_producto = (v_item->>'id_producto')::uuid;
    if v_id_marca is null then
      raise exception 'El producto % no existe', v_item->>'id_producto' using errcode = 'LOT02';
    end if;

    insert into public.inventario_producto (
      id_inventario, id_producto, id_marca, cantidad_inventario,
      fecha_vencimiento, fecha_fabricacion, observaciones, creado_por
    ) values (
      v_id_lote,
      (v_item->>'id_producto')::uuid,
      v_id_marca,
      (v_item->>'cantidad')::numeric,
      (v_item->>'fecha_vencimiento')::date,
      (v_item->>'fecha_elaboracion')::date,
      nullif(btrim(v_item->>'observaciones'), ''),
      coalesce(p_creado_por, auth.uid())
    );
  end loop;

  for v_item in select * from jsonb_array_elements(p_productos) loop
    v_movimiento := public.fn_movimiento_stock_registrar(
      v_id_tipo_ingreso,
      (v_item->>'id_producto')::uuid,
      p_id_deposito,
      (v_item->>'cantidad')::numeric,
      coalesce(p_creado_por, auth.uid())
    );
    v_movimientos := v_movimientos || jsonb_build_object(
      'id_producto', v_item->>'id_producto',
      'id_movimiento', v_movimiento.id_movimiento
    );
  end loop;

  return query select v_id_lote, p_id_comprobante, v_movimientos;
end;
$function$;

-- pendientes / resumen: nota_credito y remito no son pagables
CREATE OR REPLACE FUNCTION public.fn_comprobante_pendientes_listar(p_id_proveedor uuid, p_orden text DEFAULT 'fecha'::text)
RETURNS TABLE(id_comprobante uuid, id_proveedor uuid, nombre_proveedor text, id_tipo_comprobante uuid, nombre_tipo_comprobante text, letra character, punto_venta integer, numero integer, numero_formateado text, fecha_comprobante date, fecha_vencimiento date, importe_total numeric, saldo_pendiente numeric, estado estado_comprobante_proveedor)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  select
    c.id_comprobante, c.id_proveedor, p.nombre_proveedor,
    c.id_tipo_comprobante, tc.nombre_tipo_comprobante, tc.letra,
    c.punto_venta, c.numero,
    lpad(c.punto_venta::text, 5, '0') || '-' || lpad(c.numero::text, 8, '0') as numero_formateado,
    c.fecha_comprobante, c.fecha_vencimiento,
    c.importe_total, c.saldo_pendiente, c.estado
  from public.comprobante_proveedor c
  join public.proveedor p on p.id_proveedor = c.id_proveedor
  join public.tipo_comprobante tc on tc.id_tipo_comprobante = c.id_tipo_comprobante
  where c.id_proveedor = p_id_proveedor
    and c.saldo_pendiente > 0
    and c.anulado = false
    and c.estado <> 'Pagado'
    and tc.clase not in ('nota_credito', 'remito')
  order by
    case when p_orden = 'vencimiento' then c.fecha_vencimiento end asc nulls last,
    c.fecha_comprobante asc,
    c.creado asc;
$function$;

CREATE OR REPLACE FUNCTION public.fn_comprobante_pendientes_resumen(p_id_proveedor uuid)
RETURNS TABLE(cantidad bigint, saldo_pendiente numeric)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  select
    count(*)::bigint as cantidad,
    coalesce(sum(c.saldo_pendiente), 0) as saldo_pendiente
  from public.comprobante_proveedor c
  join public.tipo_comprobante tc on tc.id_tipo_comprobante = c.id_tipo_comprobante
  where c.id_proveedor = p_id_proveedor
    and c.saldo_pendiente > 0
    and c.anulado = false
    and c.estado <> 'Pagado'
    and tc.clase not in ('nota_credito', 'remito');
$function$;

CREATE OR REPLACE FUNCTION public.fn_comprobante_resumen(
  p_id_proveedor uuid DEFAULT NULL::uuid,
  p_desde date DEFAULT NULL::date,
  p_hasta date DEFAULT NULL::date,
  p_estado estado_comprobante_proveedor DEFAULT NULL::estado_comprobante_proveedor
)
RETURNS TABLE(cantidad bigint, importe_total numeric, importe_pagado numeric, saldo_pendiente numeric)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  select
    count(*)::bigint as cantidad,
    coalesce(sum(c.importe_total), 0) as importe_total,
    coalesce(sum(c.importe_total - c.saldo_pendiente), 0) as importe_pagado,
    coalesce(sum(c.saldo_pendiente), 0) as saldo_pendiente
  from public.comprobante_proveedor c
  join public.tipo_comprobante tc on tc.id_tipo_comprobante = c.id_tipo_comprobante
  where (p_id_proveedor is null or c.id_proveedor = p_id_proveedor)
    and (p_desde is null or c.fecha_comprobante >= p_desde)
    and (p_hasta is null or c.fecha_comprobante <= p_hasta)
    and (p_estado is null or c.estado = p_estado)
    and tc.clase not in ('nota_credito', 'remito');
$function$;
