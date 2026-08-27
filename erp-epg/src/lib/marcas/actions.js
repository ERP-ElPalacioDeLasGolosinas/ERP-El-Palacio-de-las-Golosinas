"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const PATH = "/inventario/marcas";

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
 * Lista marcas vía `fn_marca_listar` (incluye `creado_por_nombre`).
 * Sin queries directas a la tabla `marca`.
 *
 * @param {boolean} [incluirInactivas=true]
 * @returns {Promise<{ data: Array<{
 *   id_marca: string,
 *   nombre_marca: string,
 *   activo: boolean,
 *   creado: string,
 *   editado: string,
 *   creado_por: string | null,
 *   creado_por_nombre: string | null,
 * }> | null, error: string | null }>}
 */
export async function listarMarcas(incluirInactivas = true) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_marca_listar", {
    p_incluir_inactivas: Boolean(incluirInactivas),
  });

  if (error) {
    return { data: null, error: "No se pudieron cargar las marcas." };
  }

  return { data: data ?? [], error: null };
}

/**
 * @param {FormData} formData
 * @returns {Promise<{ ok: boolean, error: string | null, code?: string | null }>}
 */
export async function crearMarca(formData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      code: null,
      error: "Debés iniciar sesión para crear una marca.",
    };
  }

  const { error } = await supabase.rpc("fn_marca_crear", {
    p_nombre_marca: texto(formData, "nombre_marca"),
    p_creado_por: user.id,
  });

  if (error) {
    return errorResult(error, "No se pudo crear la marca.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

/**
 * @param {string} id_marca
 * @param {FormData} formData
 * @returns {Promise<{ ok: boolean, error: string | null, code?: string | null }>}
 */
export async function actualizarMarca(id_marca, formData) {
  if (!id_marca) {
    return {
      ok: false,
      code: null,
      error: "Falta el identificador de la marca.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_marca_modificar", {
    p_id_marca: id_marca,
    p_nombre_marca: texto(formData, "nombre_marca"),
  });

  if (error) {
    return errorResult(error, "No se pudo guardar la marca.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

/**
 * @param {string} id_marca
 */
export async function habilitarMarca(id_marca) {
  if (!id_marca) {
    return {
      ok: false,
      code: null,
      error: "Falta el identificador de la marca.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_marca_habilitar", {
    p_id_marca: id_marca,
  });

  if (error) {
    return errorResult(error, "No se pudo habilitar la marca.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

/**
 * @param {string} id_marca
 */
export async function inhabilitarMarca(id_marca) {
  if (!id_marca) {
    return {
      ok: false,
      code: null,
      error: "Falta el identificador de la marca.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_marca_inhabilitar", {
    p_id_marca: id_marca,
  });

  if (error) {
    return errorResult(error, "No se pudo inhabilitar la marca.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}
