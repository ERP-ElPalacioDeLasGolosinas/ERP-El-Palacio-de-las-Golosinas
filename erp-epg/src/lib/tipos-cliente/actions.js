"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { LISTAS_PRECIO } from "@/lib/tipos-cliente/constantes";

const PATH = "/ventas/tipos-de-cliente";
const PATH_CLIENTES = "/ventas/clientes";

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
 * Lista tipos de cliente vía `fn_tipo_cliente_listar`.
 *
 * @param {boolean} [incluirInactivos=true]
 * @returns {Promise<{ data: Array<{
 *   id_tipo_cliente: string,
 *   nombre_tipo_cliente: string,
 *   lista_precio: string,
 *   activo: boolean,
 *   creado: string,
 *   editado: string,
 *   creado_por: string | null,
 *   creado_por_nombre: string | null,
 *   cantidad_clientes: number,
 * }> | null, error: string | null }>}
 */
export async function listarTiposCliente(incluirInactivos = true) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_tipo_cliente_listar", {
    p_incluir_inactivos: Boolean(incluirInactivos),
  });

  if (error) {
    return { data: null, error: "No se pudieron cargar los tipos de cliente." };
  }

  return { data: data ?? [], error: null };
}

/**
 * @param {FormData} formData
 */
export async function crearTipoCliente(formData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      code: null,
      error: "Debés iniciar sesión para crear un tipo de cliente.",
    };
  }

  const lista = texto(formData, "lista_precio");
  if (!LISTAS_PRECIO.includes(/** @type {typeof LISTAS_PRECIO[number]} */ (lista))) {
    return {
      ok: false,
      code: "TCL02",
      error: "Elegí una lista de precios.",
    };
  }

  const { error } = await supabase.rpc("fn_tipo_cliente_crear", {
    p_nombre_tipo_cliente: texto(formData, "nombre_tipo_cliente"),
    p_lista_precio: lista,
    p_creado_por: user.id,
  });

  if (error) {
    return errorResult(error, "No se pudo crear el tipo de cliente.");
  }

  revalidatePath(PATH);
  revalidatePath(PATH_CLIENTES);
  return { ok: true, error: null, code: null };
}

/**
 * @param {string} id_tipo_cliente
 * @param {FormData} formData
 */
export async function actualizarTipoCliente(id_tipo_cliente, formData) {
  if (!id_tipo_cliente) {
    return {
      ok: false,
      code: null,
      error: "Falta el identificador del tipo de cliente.",
    };
  }

  const lista = texto(formData, "lista_precio");
  if (!LISTAS_PRECIO.includes(/** @type {typeof LISTAS_PRECIO[number]} */ (lista))) {
    return {
      ok: false,
      code: "TCL02",
      error: "Elegí una lista de precios.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_tipo_cliente_modificar", {
    p_id_tipo_cliente: id_tipo_cliente,
    p_nombre_tipo_cliente: texto(formData, "nombre_tipo_cliente"),
    p_lista_precio: lista,
  });

  if (error) {
    return errorResult(error, "No se pudo guardar el tipo de cliente.");
  }

  revalidatePath(PATH);
  revalidatePath(PATH_CLIENTES);
  return { ok: true, error: null, code: null };
}

/**
 * @param {string} id_tipo_cliente
 */
export async function habilitarTipoCliente(id_tipo_cliente) {
  if (!id_tipo_cliente) {
    return {
      ok: false,
      code: null,
      error: "Falta el identificador del tipo de cliente.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_tipo_cliente_habilitar", {
    p_id_tipo_cliente: id_tipo_cliente,
  });

  if (error) {
    return errorResult(error, "No se pudo habilitar el tipo de cliente.");
  }

  revalidatePath(PATH);
  revalidatePath(PATH_CLIENTES);
  return { ok: true, error: null, code: null };
}

/**
 * @param {string} id_tipo_cliente
 */
export async function inhabilitarTipoCliente(id_tipo_cliente) {
  if (!id_tipo_cliente) {
    return {
      ok: false,
      code: null,
      error: "Falta el identificador del tipo de cliente.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_tipo_cliente_inhabilitar", {
    p_id_tipo_cliente: id_tipo_cliente,
  });

  if (error) {
    return errorResult(error, "No se pudo inhabilitar el tipo de cliente.");
  }

  revalidatePath(PATH);
  revalidatePath(PATH_CLIENTES);
  return { ok: true, error: null, code: null };
}
