"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const PATH = "/catalogo/unidades-medida";

/**
 * Arma el resultado de error de una Server Action. Propaga el `code` (ERRCODE
 * custom UMD01..UMD06) para que el frontend pueda mapearlo por campo, y el
 * `message` del RPC tal cual (ya viene en español), con un fallback.
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
 * Lista las unidades de medida vía RPC `fn_unidad_medida_listar`.
 * Cada fila trae `creado_por_nombre` ya resuelto (LEFT JOIN vw_usuario_resumen
 * + COALESCE) desde la migración `unidad_medida_listar_con_creado_por`.
 *
 * @param {boolean} [incluirInactivas=false]
 * @returns {Promise<{ data: Array<{
 *   id_unidad_medida: string,
 *   nombre: string,
 *   abreviatura: string,
 *   activo: boolean,
 *   creado: string,
 *   editado: string,
 *   creado_por: string | null,
 *   creado_por_nombre?: string | null,
 * }> | null, error: string | null }>}
 */
export async function listarUnidadesMedida(incluirInactivas = false) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_unidad_medida_listar", {
    p_incluir_inactivas: Boolean(incluirInactivas),
  });

  if (error) {
    return { data: null, error: "No se pudieron cargar las unidades de medida." };
  }

  return { data: data ?? [], error: null };
}

/**
 * @param {FormData} formData
 * @returns {Promise<{ ok: boolean, error: string | null, code?: string | null }>}
 */
export async function crearUnidadMedida(formData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      code: null,
      error: "Debés iniciar sesión para crear una unidad de medida.",
    };
  }

  const { error } = await supabase.rpc("fn_unidad_medida_crear", {
    p_nombre: texto(formData, "nombre"),
    p_abreviatura: texto(formData, "abreviatura"),
    p_creado_por: user.id,
  });

  if (error) {
    return errorResult(error, "No se pudo crear la unidad de medida.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

/**
 * @param {string} id_unidad_medida
 * @param {FormData} formData
 * @returns {Promise<{ ok: boolean, error: string | null, code?: string | null }>}
 */
export async function actualizarUnidadMedida(id_unidad_medida, formData) {
  if (!id_unidad_medida) {
    return {
      ok: false,
      code: null,
      error: "Falta el identificador de la unidad de medida.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_unidad_medida_modificar", {
    p_id_unidad_medida: id_unidad_medida,
    p_nombre: texto(formData, "nombre"),
    p_abreviatura: texto(formData, "abreviatura"),
  });

  if (error) {
    return errorResult(error, "No se pudo guardar la unidad de medida.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

/**
 * @param {string} id_unidad_medida
 */
export async function habilitarUnidadMedida(id_unidad_medida) {
  if (!id_unidad_medida) {
    return {
      ok: false,
      code: null,
      error: "Falta el identificador de la unidad de medida.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_unidad_medida_habilitar", {
    p_id_unidad_medida: id_unidad_medida,
  });

  if (error) {
    return errorResult(error, "No se pudo habilitar la unidad de medida.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

/**
 * @param {string} id_unidad_medida
 */
export async function inhabilitarUnidadMedida(id_unidad_medida) {
  if (!id_unidad_medida) {
    return {
      ok: false,
      code: null,
      error: "Falta el identificador de la unidad de medida.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_unidad_medida_inhabilitar", {
    p_id_unidad_medida: id_unidad_medida,
  });

  if (error) {
    return errorResult(error, "No se pudo inhabilitar la unidad de medida.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

/**
 * @param {string} id_unidad_medida
 */
export async function eliminarUnidadMedida(id_unidad_medida) {
  if (!id_unidad_medida) {
    return {
      ok: false,
      code: null,
      error: "Falta el identificador de la unidad de medida.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_unidad_medida_eliminar", {
    p_id_unidad_medida: id_unidad_medida,
  });

  if (error) {
    // `fn_unidad_medida_eliminar` ya lanza un mensaje claro (UMD05) cuando la
    // unidad tiene productos asociados; se muestra tal cual.
    return errorResult(
      error,
      "No se pudo eliminar la unidad de medida porque está siendo utilizada por uno o más productos. Podés inhabilitarla en su lugar."
    );
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}
