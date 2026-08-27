"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const PATH = "/catalogo/rubros";

/**
 * Los mensajes de las funciones `fn_rubro_*` ya vienen en español y listos
 * para mostrar (ERRCODE RUB01..RUB05). Se propaga `error.message` tal cual,
 * con un fallback sólo por si el error no trae mensaje.
 * @param {{ message?: string } | null | undefined} error
 * @param {string} fallback
 */
function mensajeError(error, fallback) {
  return error?.message || fallback;
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
 * Lista los rubros vía RPC `fn_rubro_listar`. Cada fila trae `creado_por_nombre`
 * ya resuelto (LEFT JOIN vw_usuario_resumen + COALESCE).
 *
 * @param {boolean} [incluirInactivos=false]
 * @returns {Promise<{ data: Array<{
 *   id_rubro: string,
 *   nombre_rubro: string,
 *   activo: boolean,
 *   creado: string,
 *   editado: string | null,
 *   creado_por: string | null,
 *   creado_por_nombre: string | null,
 * }> | null, error: string | null }>}
 */
export async function listarRubros(incluirInactivos = false) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_rubro_listar", {
    p_incluir_inactivos: Boolean(incluirInactivos),
  });

  if (error) {
    return { data: null, error: "No se pudieron cargar los rubros." };
  }

  return { data: data ?? [], error: null };
}

/**
 * @param {FormData} formData
 */
export async function crearRubro(formData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Debés iniciar sesión para crear un rubro." };
  }

  const { error } = await supabase.rpc("fn_rubro_crear", {
    p_nombre_rubro: texto(formData, "nombre_rubro"),
    p_creado_por: user.id,
  });

  if (error) {
    return { ok: false, error: mensajeError(error, "No se pudo crear el rubro.") };
  }

  revalidatePath(PATH);
  return { ok: true, error: null };
}

/**
 * @param {string} id_rubro
 * @param {FormData} formData
 */
export async function actualizarRubro(id_rubro, formData) {
  if (!id_rubro) {
    return { ok: false, error: "Falta el identificador del rubro." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_rubro_modificar", {
    p_id_rubro: id_rubro,
    p_nombre_rubro: texto(formData, "nombre_rubro"),
  });

  if (error) {
    return { ok: false, error: mensajeError(error, "No se pudo guardar el rubro.") };
  }

  revalidatePath(PATH);
  return { ok: true, error: null };
}

/**
 * @param {string} id_rubro
 */
export async function habilitarRubro(id_rubro) {
  if (!id_rubro) {
    return { ok: false, error: "Falta el identificador del rubro." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_rubro_habilitar", {
    p_id_rubro: id_rubro,
  });

  if (error) {
    return {
      ok: false,
      error: mensajeError(error, "No se pudo habilitar el rubro."),
    };
  }

  revalidatePath(PATH);
  return { ok: true, error: null };
}

/**
 * @param {string} id_rubro
 */
export async function inhabilitarRubro(id_rubro) {
  if (!id_rubro) {
    return { ok: false, error: "Falta el identificador del rubro." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_rubro_inhabilitar", {
    p_id_rubro: id_rubro,
  });

  if (error) {
    return {
      ok: false,
      error: mensajeError(error, "No se pudo inhabilitar el rubro."),
    };
  }

  revalidatePath(PATH);
  return { ok: true, error: null };
}

/**
 * Chequeo previo de UX antes de eliminar. Devuelve el motivo de bloqueo (texto
 * en español) o `null` si el rubro se puede eliminar. La validación real la
 * hace igual `fn_rubro_eliminar` server-side (RUB03/RUB04/RUB05).
 *
 * @param {string} id_rubro
 * @returns {Promise<{ motivo: string | null, error: string | null }>}
 */
export async function motivoBloqueoEliminarRubro(id_rubro) {
  if (!id_rubro) {
    return { motivo: null, error: "Falta el identificador del rubro." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rubro_motivo_bloqueo_delete", {
    p_id_rubro: id_rubro,
  });

  if (error) {
    return {
      motivo: null,
      error: "No se pudo verificar si el rubro se puede eliminar.",
    };
  }

  const motivo = typeof data === "string" && data.trim() !== "" ? data : null;
  return { motivo, error: null };
}

/**
 * @param {string} id_rubro
 */
export async function eliminarRubro(id_rubro) {
  if (!id_rubro) {
    return { ok: false, error: "Falta el identificador del rubro." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_rubro_eliminar", {
    p_id_rubro: id_rubro,
  });

  if (error) {
    return { ok: false, error: mensajeError(error, "No se pudo eliminar el rubro.") };
  }

  revalidatePath(PATH);
  return { ok: true, error: null };
}
