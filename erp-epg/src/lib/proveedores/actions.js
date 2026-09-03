"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const PATH = "/compras/proveedores";

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
 * Lista proveedores vía `fn_proveedor_listar` (incluye `registrado_por_nombre`).
 * Sin queries directas a la tabla `proveedor`.
 *
 * @param {boolean} [incluirInactivos=true]
 * @returns {Promise<{ data: Array<{
 *   id_proveedor: string,
 *   nombre_proveedor: string,
 *   rs_proveedor: string,
 *   cuit_proveedor: string,
 *   telefono_proveedor: number | string,
 *   mail_proveedor: string,
 *   activo: boolean,
 *   creado: string,
 *   editado: string,
 *   registrado_por: string | null,
 *   registrado_por_nombre: string | null,
 * }> | null, error: string | null }>}
 */
export async function listarProveedores(incluirInactivos = true) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_proveedor_listar", {
    p_incluir_inactivos: Boolean(incluirInactivos),
  });

  if (error) {
    return { data: null, error: "No se pudieron cargar los proveedores." };
  }

  return { data: data ?? [], error: null };
}

/**
 * @param {FormData} formData
 * @returns {Promise<{ ok: boolean, error: string | null, code?: string | null }>}
 */
export async function crearProveedor(formData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      code: null,
      error: "Debés iniciar sesión para crear un proveedor.",
    };
  }

  const telefonoRaw = texto(formData, "telefono_proveedor");
  const telefono = telefonoRaw ? Number(telefonoRaw) : null;

  const { error } = await supabase.rpc("fn_proveedor_crear", {
    p_nombre_proveedor: texto(formData, "nombre_proveedor"),
    p_rs_proveedor: texto(formData, "rs_proveedor") || null,
    p_cuit_proveedor: texto(formData, "cuit_proveedor"),
    p_telefono_proveedor: Number.isFinite(telefono) ? telefono : null,
    p_mail_proveedor: texto(formData, "mail_proveedor"),
    p_registrado_por: user.id,
  });

  if (error) {
    return errorResult(error, "No se pudo crear el proveedor.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

/**
 * @param {string} id_proveedor
 * @param {FormData} formData
 * @returns {Promise<{ ok: boolean, error: string | null, code?: string | null }>}
 */
export async function actualizarProveedor(id_proveedor, formData) {
  if (!id_proveedor) {
    return {
      ok: false,
      code: null,
      error: "Falta el identificador del proveedor.",
    };
  }

  const supabase = await createClient();
  const telefonoRaw = texto(formData, "telefono_proveedor");
  const telefono = telefonoRaw ? Number(telefonoRaw) : null;

  const { error } = await supabase.rpc("fn_proveedor_modificar", {
    p_id_proveedor: id_proveedor,
    p_nombre_proveedor: texto(formData, "nombre_proveedor"),
    p_rs_proveedor: texto(formData, "rs_proveedor") || null,
    p_cuit_proveedor: texto(formData, "cuit_proveedor"),
    p_telefono_proveedor: Number.isFinite(telefono) ? telefono : null,
    p_mail_proveedor: texto(formData, "mail_proveedor"),
  });

  if (error) {
    return errorResult(error, "No se pudo guardar el proveedor.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

/**
 * @param {string} id_proveedor
 */
export async function habilitarProveedor(id_proveedor) {
  if (!id_proveedor) {
    return {
      ok: false,
      code: null,
      error: "Falta el identificador del proveedor.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_proveedor_habilitar", {
    p_id_proveedor: id_proveedor,
  });

  if (error) {
    return errorResult(error, "No se pudo habilitar el proveedor.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

/**
 * @param {string} id_proveedor
 */
export async function inhabilitarProveedor(id_proveedor) {
  if (!id_proveedor) {
    return {
      ok: false,
      code: null,
      error: "Falta el identificador del proveedor.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_proveedor_inhabilitar", {
    p_id_proveedor: id_proveedor,
  });

  if (error) {
    return errorResult(error, "No se pudo inhabilitar el proveedor.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

/**
 * @param {string} id_proveedor
 */
export async function eliminarProveedor(id_proveedor) {
  if (!id_proveedor) {
    return {
      ok: false,
      code: null,
      error: "Falta el identificador del proveedor.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_proveedor_eliminar", {
    p_id_proveedor: id_proveedor,
  });

  if (error) {
    // PRV08 ya trae el mensaje sugiriendo inhabilitar.
    return errorResult(error, "No se pudo eliminar el proveedor.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}
