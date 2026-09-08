"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TIPOS_MEDIO_PAGO } from "@/lib/medios-pago/constantes";

const PATH = "/tesoreria/medios-de-pago";

/**
 * @param {{ message?: string, code?: string } | null | undefined} error
 * @param {string} fallback
 */
function errorResult(error, fallback) {
  return {
    ok: false,
    code: error?.code ?? null,
    error: error?.message || fallback,
  };
}

/**
 * @param {FormData | Record<string, unknown>} input
 * @param {string} key
 */
function texto(input, key) {
  const value =
    typeof input.get === "function" ? input.get(key) : input[key];
  if (value == null) return "";
  return String(value).trim();
}

/**
 * @param {FormData | Record<string, unknown>} input
 * @param {string} key
 */
function booleano(input, key) {
  const value =
    typeof input.get === "function" ? input.get(key) : input[key];
  return (
    value === true ||
    value === "true" ||
    value === "on" ||
    value === "1"
  );
}

/**
 * @param {FormData | Record<string, unknown>} input
 * @returns {string[]} ids de cuentas de tesorería seleccionadas
 */
function cuentas(input) {
  const values =
    typeof input.getAll === "function"
      ? input.getAll("cuentas")
      : Array.isArray(input.cuentas)
        ? input.cuentas
        : input.cuentas != null
          ? [input.cuentas]
          : [];
  return values.map((v) => String(v).trim()).filter(Boolean);
}

/**
 * @param {FormData | Record<string, unknown>} input
 * @returns {string | null} valor válido del enum `tipo_medio_pago` o `null`
 */
function tipoMedioPago(input) {
  const value = texto(input, "tipo");
  return TIPOS_MEDIO_PAGO.includes(value) ? value : null;
}

/**
 * Lista medios de pago vía `fn_medio_pago_listar` (incluye `creado_por_nombre`,
 * `tipo` y las `cuentas` de tesorería enlazadas). Sin queries directas a la
 * tabla `medio_pago`.
 *
 * @param {boolean} [incluirInactivos=true]
 * @returns {Promise<{ data: Array<{
 *   id_medio_pago: string,
 *   nombre_medio_pago: string,
 *   tipo: string,
 *   requiere_referencia: boolean,
 *   activo: boolean,
 *   creado: string,
 *   editado: string,
 *   creado_por: string | null,
 *   creado_por_nombre: string | null,
 *   cuentas: Array<{
 *     id_cuenta: string,
 *     nombre_cuenta: string,
 *     tipo: string,
 *     activo: boolean,
 *   }>,
 * }> | null, error: string | null }>}
 */
export async function listarMediosPago(incluirInactivos = true) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_medio_pago_listar", {
    p_incluir_inactivos: Boolean(incluirInactivos),
  });

  if (error) {
    return { data: null, error: "No se pudieron cargar los medios de pago." };
  }

  return { data: data ?? [], error: null };
}

/**
 * Cuentas de tesorería activas enlazadas a un medio de pago
 * (`fn_medio_pago_cuentas_compatibles`). Insumo de los formularios de orden de
 * pago (T-07) y de pago (T-08).
 *
 * @param {string} idMedioPago
 * @returns {Promise<{ data: Array<{
 *   id_cuenta: string,
 *   nombre_cuenta: string,
 *   tipo: string,
 *   saldo_actual: number,
 *   activo: boolean,
 * }> | null, error: string | null }>}
 */
export async function listarCuentasCompatibles(idMedioPago) {
  if (!idMedioPago) {
    return { data: null, error: "Falta el identificador del medio de pago." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "fn_medio_pago_cuentas_compatibles",
    { p_id_medio_pago: idMedioPago }
  );

  if (error) {
    return { data: null, error: "No se pudieron cargar las cuentas del medio de pago." };
  }

  return { data: data ?? [], error: null };
}

/**
 * @param {FormData} formData
 * @returns {Promise<{ ok: boolean, error: string | null, code?: string | null }>}
 */
export async function crearMedioPago(formData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      code: null,
      error: "Debés iniciar sesión para crear un medio de pago.",
    };
  }

  const { error } = await supabase.rpc("fn_medio_pago_crear", {
    p_nombre_medio_pago: texto(formData, "nombre_medio_pago"),
    p_tipo: tipoMedioPago(formData),
    p_requiere_referencia: booleano(formData, "requiere_referencia"),
    p_creado_por: user.id,
    p_cuentas: cuentas(formData),
  });

  if (error) {
    return errorResult(error, "No se pudo crear el medio de pago.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

/**
 * @param {string} id_medio_pago
 * @param {FormData} formData
 * @returns {Promise<{ ok: boolean, error: string | null, code?: string | null }>}
 */
export async function actualizarMedioPago(id_medio_pago, formData) {
  if (!id_medio_pago) {
    return {
      ok: false,
      code: null,
      error: "Falta el identificador del medio de pago.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_medio_pago_modificar", {
    p_id_medio_pago: id_medio_pago,
    p_nombre_medio_pago: texto(formData, "nombre_medio_pago"),
    p_tipo: tipoMedioPago(formData),
    p_requiere_referencia: booleano(formData, "requiere_referencia"),
    p_cuentas: cuentas(formData),
  });

  if (error) {
    return errorResult(error, "No se pudo guardar el medio de pago.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

/**
 * @param {string} id_medio_pago
 */
export async function habilitarMedioPago(id_medio_pago) {
  if (!id_medio_pago) {
    return {
      ok: false,
      code: null,
      error: "Falta el identificador del medio de pago.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_medio_pago_habilitar", {
    p_id_medio_pago: id_medio_pago,
  });

  if (error) {
    return errorResult(error, "No se pudo habilitar el medio de pago.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

/**
 * @param {string} id_medio_pago
 */
export async function inhabilitarMedioPago(id_medio_pago) {
  if (!id_medio_pago) {
    return {
      ok: false,
      code: null,
      error: "Falta el identificador del medio de pago.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_medio_pago_inhabilitar", {
    p_id_medio_pago: id_medio_pago,
  });

  if (error) {
    return errorResult(error, "No se pudo inhabilitar el medio de pago.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}
