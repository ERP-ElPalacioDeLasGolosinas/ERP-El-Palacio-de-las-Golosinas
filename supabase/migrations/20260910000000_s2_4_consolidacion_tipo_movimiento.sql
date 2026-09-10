-- =====================================================================
-- S2-4 | Consolidacion de S-04 (tipos de movimiento)
-- Sprint 2 - ERP El Palacio de las Golosinas
--
-- Estado: aplicada en Supabase el 2026-09-10
--         (migracion s2_4_consolidacion_tipo_movimiento).
--
-- Alinea tipo_movimiento con el patron general del resto de catalogos:
--   (a) nueva columna descripcion (opcional, editable).
--   (b) signo INMUTABLE tras el alta (decision de negocio D-021):
--       - se corrige y engancha el trigger fn_tipo_movimiento_signo_inmutable
--         (usaba la columna inexistente signo_tipo_movimiento y no estaba
--         adjunto). Errcode nuevo TMV06.
--       - fn_tipo_movimiento_modificar deja de recibir/actualizar p_signo.
--   (c) fn_tipo_movimiento_listar pasa a RETURNS TABLE con creado_por_nombre
--       (via vw_usuario_resumen), como fn_deposito_listar / fn_unidad_medida_listar.
--   (d) trigger trg_set_editado_tipo_movimiento (patron set_editado_<tabla>).
--
-- Patron: SECURITY INVOKER, sin GRANT explicito; acceso por RLS authenticated.
-- =====================================================================

-- (a) descripcion -----------------------------------------------------
ALTER TABLE public.tipo_movimiento
  ADD COLUMN IF NOT EXISTS descripcion text;

-- (d) editado por trigger -------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_editado_tipo_movimiento()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
begin
  new.editado := now();
  new.creado := old.creado;
  new.creado_por := old.creado_por;
  return new;
end;
$function$;

DROP TRIGGER IF EXISTS trg_set_editado_tipo_movimiento ON public.tipo_movimiento;
CREATE TRIGGER trg_set_editado_tipo_movimiento
  BEFORE UPDATE ON public.tipo_movimiento
  FOR EACH ROW EXECUTE FUNCTION public.set_editado_tipo_movimiento();

-- (b) signo inmutable ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_tipo_movimiento_signo_inmutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
begin
  if new.signo is distinct from old.signo then
    raise exception
      'El signo del tipo de movimiento no puede modificarse una vez creado.'
      using errcode = 'TMV06';
  end if;
  return new;
end;
$function$;

DROP TRIGGER IF EXISTS trg_tipo_movimiento_signo_inmutable ON public.tipo_movimiento;
CREATE TRIGGER trg_tipo_movimiento_signo_inmutable
  BEFORE UPDATE ON public.tipo_movimiento
  FOR EACH ROW EXECUTE FUNCTION public.fn_tipo_movimiento_signo_inmutable();

-- (c) listar alineado al patron --------------------------------------
DROP FUNCTION IF EXISTS public.fn_tipo_movimiento_listar(boolean);
CREATE FUNCTION public.fn_tipo_movimiento_listar(p_incluir_inactivos boolean DEFAULT true)
RETURNS TABLE(
  id_tipo_movimiento uuid,
  nombre text,
  descripcion text,
  signo smallint,
  requiere_control_stock boolean,
  requiere_deposito_destino boolean,
  activo boolean,
  creado timestamptz,
  editado timestamptz,
  creado_por uuid,
  creado_por_nombre text
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT
    tm.id_tipo_movimiento,
    tm.nombre,
    tm.descripcion,
    tm.signo,
    tm.requiere_control_stock,
    tm.requiere_deposito_destino,
    tm.activo,
    tm.creado,
    tm.editado,
    tm.creado_por,
    COALESCE(ur.nombre_completo, 'Usuario no disponible') AS creado_por_nombre
  FROM public.tipo_movimiento tm
  LEFT JOIN public.vw_usuario_resumen ur ON ur.id_usuario = tm.creado_por
  WHERE p_incluir_inactivos OR tm.activo = true
  ORDER BY tm.nombre;
$function$;

-- crear: suma p_descripcion ------------------------------------------
DROP FUNCTION IF EXISTS public.fn_tipo_movimiento_crear(text, smallint, uuid, boolean);
CREATE FUNCTION public.fn_tipo_movimiento_crear(
  p_nombre text,
  p_signo smallint,
  p_creado_por uuid,
  p_requiere_control_stock boolean DEFAULT true,
  p_descripcion text DEFAULT NULL
)
RETURNS tipo_movimiento
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_nombre text := btrim(p_nombre);
  v_tipo   public.tipo_movimiento;
BEGIN
  IF v_nombre IS NULL OR length(v_nombre) = 0 THEN
    RAISE EXCEPTION 'El nombre del tipo de movimiento no puede estar vacío'
      USING ERRCODE = 'TMV01';
  END IF;

  IF p_signo IS NULL THEN
    RAISE EXCEPTION 'Debe definir el signo del tipo de movimiento (positivo o negativo)'
      USING ERRCODE = 'TMV05';
  END IF;

  IF p_signo NOT IN (1, -1) THEN
    RAISE EXCEPTION 'El signo debe ser 1 (positivo) o -1 (negativo)'
      USING ERRCODE = 'TMV04';
  END IF;

  IF EXISTS (SELECT 1 FROM public.tipo_movimiento WHERE lower(btrim(nombre)) = lower(v_nombre)) THEN
    RAISE EXCEPTION 'Ya existe un tipo de movimiento con el nombre "%"', v_nombre
      USING ERRCODE = 'TMV02';
  END IF;

  BEGIN
    INSERT INTO public.tipo_movimiento (nombre, descripcion, signo, requiere_control_stock, creado_por)
    VALUES (v_nombre, nullif(btrim(p_descripcion), ''), p_signo, COALESCE(p_requiere_control_stock, true), p_creado_por)
    RETURNING * INTO v_tipo;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'Ya existe un tipo de movimiento con el nombre "%"', v_nombre
        USING ERRCODE = 'TMV02';
  END;

  RETURN v_tipo;
END;
$function$;

-- modificar: sin p_signo, suma p_descripcion ------------------------
DROP FUNCTION IF EXISTS public.fn_tipo_movimiento_modificar(uuid, text, smallint, boolean);
CREATE FUNCTION public.fn_tipo_movimiento_modificar(
  p_id_tipo_movimiento uuid,
  p_nombre text,
  p_descripcion text DEFAULT NULL,
  p_requiere_control_stock boolean DEFAULT true
)
RETURNS tipo_movimiento
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_nombre text := btrim(p_nombre);
  v_tipo   public.tipo_movimiento;
BEGIN
  IF v_nombre IS NULL OR length(v_nombre) = 0 THEN
    RAISE EXCEPTION 'El nombre del tipo de movimiento no puede estar vacío'
      USING ERRCODE = 'TMV01';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tipo_movimiento WHERE id_tipo_movimiento = p_id_tipo_movimiento) THEN
    RAISE EXCEPTION 'No se encontró el tipo de movimiento indicado'
      USING ERRCODE = 'TMV03';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.tipo_movimiento
    WHERE lower(btrim(nombre)) = lower(v_nombre) AND id_tipo_movimiento <> p_id_tipo_movimiento
  ) THEN
    RAISE EXCEPTION 'Ya existe otro tipo de movimiento con el nombre "%"', v_nombre
      USING ERRCODE = 'TMV02';
  END IF;

  BEGIN
    UPDATE public.tipo_movimiento
    SET nombre = v_nombre,
        descripcion = nullif(btrim(p_descripcion), ''),
        requiere_control_stock = COALESCE(p_requiere_control_stock, true),
        editado = now()
    WHERE id_tipo_movimiento = p_id_tipo_movimiento
    RETURNING * INTO v_tipo;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'Ya existe otro tipo de movimiento con el nombre "%"', v_nombre
        USING ERRCODE = 'TMV02';
  END;

  RETURN v_tipo;
END;
$function$;
