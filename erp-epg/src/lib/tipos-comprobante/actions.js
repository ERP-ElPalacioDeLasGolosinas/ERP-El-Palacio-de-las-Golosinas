"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const PATH = "/tesoreria/tipos-de-comprobante";

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
 * @param {string} key
 * @returns {number | null}
 */
function signo(input, key) {
  const raw = texto(input, key);
  if (raw === "1") return 1;
  if (raw === "-1") return -1;
  return null;
}

/**
 * @param {FormData | Record<string, unknown>} input
 * @param {string} key
 * @returns {string | null}
 */
function letra(input, key) {
  const raw = texto(input, key).toUpperCase();
  if (!raw) return null;
  return raw;
}

/**
 * Lista tipos de comprobante vía `fn_tipo_comprobante_listar`.
 * Pantalla C-06: filtra `p_aplica_compra: true`.
 *
 * @param {boolean} [incluirInactivos=true]
 * @returns {Promise<{ data: Array<{
 *   id_tipo_comprobante: string,
 *   nombre_tipo_comprobante: string,
 *   letra: string | null,
 *   es_fiscal: boolean,
 *   signo: number,
 *   aplica_compra: boolean,
 *   aplica_venta: boolean,
 *   aplica_pago: boolean,
 *   activo: boolean,
 *   creado: string,
 *   editado: string,
 *   creado_por: string | null,
 *   creado_por_nombre: string | null,
 * }> | null, error: string | null }>}
 */
export async function listarTiposComprobante(incluirInactivos = true) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_tipo_comprobante_listar", {
    p_incluir_inactivos: Boolean(incluirInactivos),
    p_aplica_compra: true,
  });

  if (error) {
    return {
      data: null,
      error: "No se pudieron cargar los tipos de comprobante.",
    };
  }

  return { data: data ?? [], error: null };
}

/**
 * @param {FormData} formData
 * @returns {Promise<{ ok: boolean, error: string | null, code?: string | null }>}
 */
export async function crearTipoComprobante(formData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      code: null,
      error: "Debés iniciar sesión para crear un tipo de comprobante.",
    };
  }

  const p_signo = signo(formData, "signo");
  if (p_signo == null) {
    return {
      ok: false,
      code: "CPB04",
      error: "El signo debe ser 1 o -1.",
    };
  }

  const { error } = await supabase.rpc("fn_tipo_comprobante_crear", {
    p_nombre_tipo_comprobante: texto(formData, "nombre_tipo_comprobante"),
    p_signo,
    p_creado_por: user.id,
    p_letra: letra(formData, "letra"),
    p_es_fiscal: booleano(formData, "es_fiscal"),
    p_aplica_compra: true,
    p_aplica_venta: false,
    p_aplica_pago: false,
  });

  if (error) {
    return errorResult(error, "No se pudo crear el tipo de comprobante.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

/**
 * @param {string} id_tipo_comprobante
 * @param {FormData} formData
 * @returns {Promise<{ ok: boolean, error: string | null, code?: string | null }>}
 */
export async function actualizarTipoComprobante(
  id_tipo_comprobante,
  formData
) {
  if (!id_tipo_comprobante) {
    return {
      ok: false,
      code: null,
      error: "Falta el identificador del tipo de comprobante.",
    };
  }

  const p_signo = signo(formData, "signo");
  if (p_signo == null) {
    return {
      ok: false,
      code: "CPB04",
      error: "El signo debe ser 1 o -1.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_tipo_comprobante_modificar", {
    p_id_tipo_comprobante: id_tipo_comprobante,
    p_nombre_tipo_comprobante: texto(formData, "nombre_tipo_comprobante"),
    p_signo,
    p_letra: letra(formData, "letra"),
    p_es_fiscal: booleano(formData, "es_fiscal"),
    p_aplica_compra: true,
    // Conservar flags de otros módulos (esta pantalla no los edita).
    p_aplica_venta: booleano(formData, "aplica_venta"),
    p_aplica_pago: booleano(formData, "aplica_pago"),
  });

  if (error) {
    return errorResult(error, "No se pudo guardar el tipo de comprobante.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

/**
 * @param {string} id_tipo_comprobante
 */
export async function habilitarTipoComprobante(id_tipo_comprobante) {
  if (!id_tipo_comprobante) {
    return {
      ok: false,
      code: null,
      error: "Falta el identificador del tipo de comprobante.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_tipo_comprobante_habilitar", {
    p_id_tipo_comprobante: id_tipo_comprobante,
  });

  if (error) {
    return errorResult(error, "No se pudo habilitar el tipo de comprobante.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

/**
 * @param {string} id_tipo_comprobante
 */
export async function inhabilitarTipoComprobante(id_tipo_comprobante) {
  if (!id_tipo_comprobante) {
    return {
      ok: false,
      code: null,
      error: "Falta el identificador del tipo de comprobante.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_tipo_comprobante_inhabilitar", {
    p_id_tipo_comprobante: id_tipo_comprobante,
  });

  if (error) {
    return errorResult(
      error,
      "No se pudo inhabilitar el tipo de comprobante."
    );
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}
