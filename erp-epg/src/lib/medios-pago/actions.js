"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
 * Lista medios de pago vía `fn_medio_pago_listar` (incluye `creado_por_nombre`).
 * Sin queries directas a la tabla `medio_pago`.
 *
 * @param {boolean} [incluirInactivos=true]
 * @returns {Promise<{ data: Array<{
 *   id_medio_pago: string,
 *   nombre_medio_pago: string,
 *   requiere_referencia: boolean,
 *   activo: boolean,
 *   creado: string,
 *   editado: string,
 *   creado_por: string | null,
 *   creado_por_nombre: string | null,
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
    p_requiere_referencia: booleano(formData, "requiere_referencia"),
    p_creado_por: user.id,
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
    p_requiere_referencia: booleano(formData, "requiere_referencia"),
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
