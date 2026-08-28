"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const PATH = "/inventario/movimientos/tipos";

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
function entero(input, key) {
  const value =
    typeof input.get === "function" ? input.get(key) : input[key];
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {FormData | Record<string, unknown>} input
 * @param {string} key
 */
function booleano(input, key) {
  const value =
    typeof input.get === "function" ? input.get(key) : input[key];
  return value === "on" || value === "true" || value === true;
}

export async function listarTiposMovimiento(incluirInactivos = true) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_tipo_movimiento_listar", {
    p_incluir_inactivos: Boolean(incluirInactivos),
  });

  if (error) {
    return { data: null, error: "No se pudieron cargar los tipos de movimiento." };
  }

  return { data: data ?? [], error: null };
}

export async function crearTipoMovimiento(formData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      code: null,
      error: "Debés iniciar sesión para crear un tipo de movimiento.",
    };
  }

  const { error } = await supabase.rpc("fn_tipo_movimiento_crear", {
    p_nombre: texto(formData, "nombre"),
    p_signo: entero(formData, "signo"),
    p_creado_por: user.id,
    p_requiere_control_stock: booleano(formData, "requiere_control_stock"),
  });

  if (error) {
    return errorResult(error, "No se pudo crear el tipo de movimiento.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

export async function actualizarTipoMovimiento(id_tipo_movimiento, formData) {
  if (!id_tipo_movimiento) {
    return {
      ok: false,
      code: null,
      error: "Falta el identificador del tipo de movimiento.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_tipo_movimiento_modificar", {
    p_id_tipo_movimiento: id_tipo_movimiento,
    p_nombre: texto(formData, "nombre"),
    p_signo: entero(formData, "signo"),
    p_requiere_control_stock: booleano(formData, "requiere_control_stock"),
  });

  if (error) {
    return errorResult(error, "No se pudo guardar el tipo de movimiento.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

export async function habilitarTipoMovimiento(id_tipo_movimiento) {
  if (!id_tipo_movimiento) {
    return {
      ok: false,
      code: null,
      error: "Falta el identificador del tipo de movimiento.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_tipo_movimiento_habilitar", {
    p_id_tipo_movimiento: id_tipo_movimiento,
  });

  if (error) {
    return errorResult(error, "No se pudo habilitar el tipo de movimiento.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

export async function inhabilitarTipoMovimiento(id_tipo_movimiento) {
  if (!id_tipo_movimiento) {
    return {
      ok: false,
      code: null,
      error: "Falta el identificador del tipo de movimiento.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_tipo_movimiento_inhabilitar", {
    p_id_tipo_movimiento: id_tipo_movimiento,
  });

  if (error) {
    return errorResult(error, "No se pudo inhabilitar el tipo de movimiento.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}
