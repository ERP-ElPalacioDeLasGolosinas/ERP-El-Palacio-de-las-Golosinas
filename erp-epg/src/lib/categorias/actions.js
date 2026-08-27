"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const PATH = "/catalogo/categorias";

/**
 * Arma el resultado de error de una Server Action. Propaga el `code` (ERRCODE
 * custom CAT01..CAT06) para que el frontend pueda reaccionar (p. ej. refrescar
 * ante CAT03), y el `message` del RPC tal cual (ya viene en español).
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
 * Lista las categorías vía RPC `fn_categoria_listar`. Cada fila trae
 * `nombre_rubro` (JOIN a `rubro`) y `creado_por_nombre` (LEFT JOIN
 * `vw_usuario_resumen` + COALESCE) ya resueltos.
 *
 * @param {boolean} [incluirInactivos=false]
 * @returns {Promise<{ data: Array<{
 *   id_categoria: string,
 *   nombre_categoria: string,
 *   activo: boolean,
 *   id_rubro: string,
 *   nombre_rubro: string,
 *   creado: string,
 *   editado: string | null,
 *   creado_por: string | null,
 *   creado_por_nombre: string | null,
 * }> | null, error: string | null }>}
 */
export async function listarCategorias(incluirInactivos = false) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_categoria_listar", {
    p_incluir_inactivos: Boolean(incluirInactivos),
  });

  if (error) {
    return { data: null, error: "No se pudieron cargar las categorías." };
  }

  return { data: data ?? [], error: null };
}

/**
 * @param {FormData} formData
 * @returns {Promise<{ ok: boolean, error: string | null, code?: string | null }>}
 */
export async function crearCategoria(formData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      code: null,
      error: "Debés iniciar sesión para crear una categoría.",
    };
  }

  const { error } = await supabase.rpc("fn_categoria_crear", {
    p_nombre_categoria: texto(formData, "nombre_categoria"),
    p_id_rubro: texto(formData, "id_rubro") || null,
    p_creado_por: user.id,
  });

  if (error) {
    return errorResult(error, "No se pudo crear la categoría.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

/**
 * Modifica la categoría. Pasar un `id_rubro` distinto la reasocia a otro rubro;
 * la función RPC además re-sincroniza `producto.id_rubro` en cascada.
 *
 * @param {string} id_categoria
 * @param {FormData} formData
 * @returns {Promise<{ ok: boolean, error: string | null, code?: string | null }>}
 */
export async function actualizarCategoria(id_categoria, formData) {
  if (!id_categoria) {
    return {
      ok: false,
      code: null,
      error: "Falta el identificador de la categoría.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_categoria_modificar", {
    p_id_categoria: id_categoria,
    p_nombre_categoria: texto(formData, "nombre_categoria"),
    p_id_rubro: texto(formData, "id_rubro") || null,
  });

  if (error) {
    return errorResult(error, "No se pudo guardar la categoría.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

/**
 * @param {string} id_categoria
 */
export async function habilitarCategoria(id_categoria) {
  if (!id_categoria) {
    return { ok: false, code: null, error: "Falta el identificador de la categoría." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_categoria_habilitar", {
    p_id_categoria: id_categoria,
  });

  if (error) {
    return errorResult(error, "No se pudo habilitar la categoría.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

/**
 * @param {string} id_categoria
 */
export async function inhabilitarCategoria(id_categoria) {
  if (!id_categoria) {
    return { ok: false, code: null, error: "Falta el identificador de la categoría." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_categoria_inhabilitar", {
    p_id_categoria: id_categoria,
  });

  if (error) {
    return errorResult(error, "No se pudo inhabilitar la categoría.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

/**
 * Chequeo previo de UX antes de eliminar. Devuelve el motivo de bloqueo (texto
 * en español) o `null` si la categoría se puede eliminar. La validación real la
 * hace igual `fn_categoria_eliminar` server-side (CAT03/CAT04).
 *
 * @param {string} id_categoria
 * @returns {Promise<{ motivo: string | null, error: string | null }>}
 */
export async function motivoBloqueoEliminarCategoria(id_categoria) {
  if (!id_categoria) {
    return { motivo: null, error: "Falta el identificador de la categoría." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("categoria_motivo_bloqueo_delete", {
    p_id_categoria: id_categoria,
  });

  if (error) {
    return {
      motivo: null,
      error: "No se pudo verificar si la categoría se puede eliminar.",
    };
  }

  const motivo = typeof data === "string" && data.trim() !== "" ? data : null;
  return { motivo, error: null };
}

/**
 * @param {string} id_categoria
 */
export async function eliminarCategoria(id_categoria) {
  if (!id_categoria) {
    return { ok: false, code: null, error: "Falta el identificador de la categoría." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_categoria_eliminar", {
    p_id_categoria: id_categoria,
  });

  if (error) {
    return errorResult(error, "No se pudo eliminar la categoría.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}
