-- =====================================================================
-- S2-7 paso 1 | tipo_comprobante.clase + ABM de tipos (D-022)
-- Sprint 2 - ERP El Palacio de las Golosinas
--
-- Estado: aplicada en Supabase el 2026-09-10
--         (migracion s2_7_tipo_comprobante_clase).
--
-- Clasifica cada tipo de comprobante de proveedor por documento
-- (factura / nota de credito / nota de debito / remito). La direccion
-- del efecto sobre la deuda la derivara Tesoreria mas adelante; aca solo
-- se registra la clase. NO se restaura tipo_comprobante.signo (D-020).
--
--   (a) columna clase text NOT NULL DEFAULT 'factura' + CHECK del set.
--   (b) backfill por nombre (Factura A/B -> factura, NC A -> nota_credito,
--       ND A -> nota_debito, Remito -> remito).
--   (c) fn_tipo_comprobante_crear / _modificar reciben p_clase (errcode
--       nuevo CPB06); fn_tipo_comprobante_listar la devuelve.
--
-- Patron: SECURITY INVOKER, GRANT EXECUTE a anon/authenticated/service_role
-- (identico al estado previo de estas funciones).
-- =====================================================================

-- (a) columna clase ---------------------------------------------------
ALTER TABLE public.tipo_comprobante
  ADD COLUMN IF NOT EXISTS clase text NOT NULL DEFAULT 'factura';

-- (b) backfill por nombre (antes de aplicar el CHECK) ----------------
UPDATE public.tipo_comprobante SET clase = 'nota_credito'
  WHERE clase = 'factura' AND lower(nombre_tipo_comprobante) LIKE 'nota de cr%dito%';
UPDATE public.tipo_comprobante SET clase = 'nota_debito'
  WHERE clase = 'factura' AND lower(nombre_tipo_comprobante) LIKE 'nota de d%bito%';
UPDATE public.tipo_comprobante SET clase = 'remito'
  WHERE clase = 'factura' AND lower(nombre_tipo_comprobante) LIKE 'remito%';

ALTER TABLE public.tipo_comprobante
  DROP CONSTRAINT IF EXISTS tipo_comprobante_clase_check;
ALTER TABLE public.tipo_comprobante
  ADD CONSTRAINT tipo_comprobante_clase_check
  CHECK (clase IN ('factura', 'nota_credito', 'nota_debito', 'remito'));

-- (c) funciones -----------------------------------------------------------
-- Se agrega p_clase con DEFAULT: hay que DROP + CREATE (no alcanza
-- CREATE OR REPLACE porque cambia la firma).
DROP FUNCTION IF EXISTS public.fn_tipo_comprobante_crear(
  text, uuid, character, boolean, boolean, boolean, boolean);
DROP FUNCTION IF EXISTS public.fn_tipo_comprobante_modificar(
  uuid, text, character, boolean, boolean, boolean, boolean);
DROP FUNCTION IF EXISTS public.fn_tipo_comprobante_listar(
  boolean, boolean, boolean, boolean);

CREATE FUNCTION public.fn_tipo_comprobante_crear(
  p_nombre_tipo_comprobante text,
  p_creado_por uuid,
  p_letra character DEFAULT NULL::bpchar,
  p_es_fiscal boolean DEFAULT true,
  p_aplica_compra boolean DEFAULT true,
  p_aplica_venta boolean DEFAULT false,
  p_aplica_pago boolean DEFAULT false,
  p_clase text DEFAULT 'factura'
)
RETURNS tipo_comprobante
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
declare
  v_nombre           text := btrim(p_nombre_tipo_comprobante);
  v_clase            text := coalesce(nullif(btrim(p_clase), ''), 'factura');
  v_tipo_comprobante public.tipo_comprobante;
begin
  if v_nombre is null or length(v_nombre) = 0 then
    raise exception 'El nombre del tipo de comprobante no puede estar vacío' using errcode = 'CPB01';
  end if;
  if p_letra is not null and p_letra not in ('A', 'B', 'C') then
    raise exception 'La letra debe ser A, B o C (o no informarse)' using errcode = 'CPB05';
  end if;
  if v_clase not in ('factura', 'nota_credito', 'nota_debito', 'remito') then
    raise exception 'La clase del tipo de comprobante no es válida' using errcode = 'CPB06';
  end if;
  if exists (select 1 from public.tipo_comprobante where lower(nombre_tipo_comprobante) = lower(v_nombre)) then
    raise exception 'Ya existe un tipo de comprobante con el nombre "%"', v_nombre using errcode = 'CPB02';
  end if;

  begin
    insert into public.tipo_comprobante (
      nombre_tipo_comprobante, letra, es_fiscal,
      aplica_compra, aplica_venta, aplica_pago, clase, creado_por
    ) values (
      v_nombre, p_letra, coalesce(p_es_fiscal, true),
      coalesce(p_aplica_compra, true), coalesce(p_aplica_venta, false), coalesce(p_aplica_pago, false),
      v_clase, p_creado_por
    )
    returning * into v_tipo_comprobante;
  exception
    when unique_violation then
      raise exception 'Ya existe un tipo de comprobante con el nombre "%"', v_nombre using errcode = 'CPB02';
  end;

  return v_tipo_comprobante;
end;
$function$;

CREATE FUNCTION public.fn_tipo_comprobante_modificar(
  p_id_tipo_comprobante uuid,
  p_nombre_tipo_comprobante text,
  p_letra character DEFAULT NULL::bpchar,
  p_es_fiscal boolean DEFAULT true,
  p_aplica_compra boolean DEFAULT true,
  p_aplica_venta boolean DEFAULT false,
  p_aplica_pago boolean DEFAULT false,
  p_clase text DEFAULT NULL::text
)
RETURNS tipo_comprobante
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
declare
  v_nombre           text := btrim(p_nombre_tipo_comprobante);
  v_clase            text := nullif(btrim(p_clase), '');
  v_tipo_comprobante public.tipo_comprobante;
begin
  if v_nombre is null or length(v_nombre) = 0 then
    raise exception 'El nombre del tipo de comprobante no puede estar vacío' using errcode = 'CPB01';
  end if;
  if p_letra is not null and p_letra not in ('A', 'B', 'C') then
    raise exception 'La letra debe ser A, B o C (o no informarse)' using errcode = 'CPB05';
  end if;
  if v_clase is not null and v_clase not in ('factura', 'nota_credito', 'nota_debito', 'remito') then
    raise exception 'La clase del tipo de comprobante no es válida' using errcode = 'CPB06';
  end if;
  if not exists (select 1 from public.tipo_comprobante where id_tipo_comprobante = p_id_tipo_comprobante) then
    raise exception 'No se encontró el tipo de comprobante indicado' using errcode = 'CPB03';
  end if;
  if exists (
    select 1 from public.tipo_comprobante
    where lower(nombre_tipo_comprobante) = lower(v_nombre) and id_tipo_comprobante <> p_id_tipo_comprobante
  ) then
    raise exception 'Ya existe otro tipo de comprobante con el nombre "%"', v_nombre using errcode = 'CPB02';
  end if;

  begin
    update public.tipo_comprobante
    set nombre_tipo_comprobante = v_nombre,
        letra = p_letra,
        es_fiscal = coalesce(p_es_fiscal, es_fiscal),
        aplica_compra = coalesce(p_aplica_compra, aplica_compra),
        aplica_venta = coalesce(p_aplica_venta, aplica_venta),
        aplica_pago = coalesce(p_aplica_pago, aplica_pago),
        clase = coalesce(v_clase, clase)
    where id_tipo_comprobante = p_id_tipo_comprobante
    returning * into v_tipo_comprobante;
  exception
    when unique_violation then
      raise exception 'Ya existe otro tipo de comprobante con el nombre "%"', v_nombre using errcode = 'CPB02';
  end;

  return v_tipo_comprobante;
end;
$function$;

CREATE FUNCTION public.fn_tipo_comprobante_listar(
  p_incluir_inactivos boolean DEFAULT true,
  p_aplica_compra boolean DEFAULT NULL::boolean,
  p_aplica_venta boolean DEFAULT NULL::boolean,
  p_aplica_pago boolean DEFAULT NULL::boolean
)
RETURNS TABLE(
  id_tipo_comprobante uuid,
  nombre_tipo_comprobante text,
  letra character,
  clase text,
  es_fiscal boolean,
  aplica_compra boolean,
  aplica_venta boolean,
  aplica_pago boolean,
  activo boolean,
  creado timestamp with time zone,
  editado timestamp with time zone,
  creado_por uuid,
  creado_por_nombre text
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  select
    tc.id_tipo_comprobante, tc.nombre_tipo_comprobante, tc.letra, tc.clase,
    tc.es_fiscal, tc.aplica_compra, tc.aplica_venta, tc.aplica_pago,
    tc.activo, tc.creado, tc.editado, tc.creado_por,
    coalesce(ur.nombre_completo, 'Usuario no disponible') as creado_por_nombre
  from public.tipo_comprobante tc
  left join public.vw_usuario_resumen ur on ur.id_usuario = tc.creado_por
  where (p_incluir_inactivos or tc.activo = true)
    and (p_aplica_compra is null or tc.aplica_compra = p_aplica_compra)
    and (p_aplica_venta  is null or tc.aplica_venta  = p_aplica_venta)
    and (p_aplica_pago   is null or tc.aplica_pago   = p_aplica_pago)
  order by tc.nombre_tipo_comprobante;
$function$;

-- grants (identico al estado previo de estas funciones) ----------------
GRANT EXECUTE ON FUNCTION public.fn_tipo_comprobante_crear(
  text, uuid, character, boolean, boolean, boolean, boolean, text)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_tipo_comprobante_modificar(
  uuid, text, character, boolean, boolean, boolean, boolean, text)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_tipo_comprobante_listar(
  boolean, boolean, boolean, boolean)
  TO anon, authenticated, service_role;
