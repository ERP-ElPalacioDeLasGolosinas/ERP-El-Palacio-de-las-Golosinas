"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TIPOS_CUENTA } from "@/lib/cuentas-tesoreria/constantes";

const PATH = "/tesoreria/cuentas";

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
  const value = typeof input.get === "function" ? input.get(key) : input[key];
  if (value == null) return "";
  return String(value).trim();
}

/**
 * @param {FormData | Record<string, unknown>} input
 * @param {string} key
 */
function numero(input, key) {
  const value = typeof input.get === "function" ? input.get(key) : input[key];
  if (value == null || String(value).trim() === "") return 0;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Lista cuentas de tesorería vía `fn_cuenta_tesoreria_listar`
 * (incluye `creado_por_nombre`). Sin queries directas a la tabla.
 *
 * @param {boolean} [incluirInactivas=true]
 * @param {string | null} [tipo=null] Uno de {@link TIPOS_CUENTA} o `null`.
 */
export async function listarCuentasTesoreria(
  incluirInactivas = true,
  tipo = null
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_cuenta_tesoreria_listar", {
    p_incluir_inactivas: Boolean(incluirInactivas),
    p_tipo: TIPOS_CUENTA.includes(tipo) ? tipo : null,
  });

  if (error) {
    return { data: null, error: "No se pudieron cargar las cuentas de tesorería." };
  }

  return { data: data ?? [], error: null };
}

/**
 * @param {string} idCuenta
 * @param {string | null} [desde=null]
 * @param {string | null} [hasta=null]
 */
export async function listarMovimientosCuenta(idCuenta, desde = null, hasta = null) {
  if (!idCuenta) {
    return { data: null, error: "Falta el identificador de la cuenta." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "fn_cuenta_tesoreria_movimientos_listar",
    {
      p_id_cuenta: idCuenta,
      p_desde: desde || null,
      p_hasta: hasta || null,
    }
  );

  if (error) {
    return { data: null, error: "No se pudieron cargar los movimientos de la cuenta." };
  }

  return { data: data ?? [], error: null };
}

/**
 * @param {FormData} formData
 * @returns {Promise<{ ok: boolean, error: string | null, code?: string | null }>}
 */
export async function crearCuentaTesoreria(formData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      code: null,
      error: "Debés iniciar sesión para crear una cuenta de tesorería.",
    };
  }

  const { error } = await supabase.rpc("fn_cuenta_tesoreria_crear", {
    p_nombre: texto(formData, "nombre_cuenta"),
    p_tipo: texto(formData, "tipo"),
    p_descripcion: texto(formData, "descripcion") || null,
    p_saldo_inicial: numero(formData, "saldo_inicial"),
    p_creado_por: user.id,
  });

  if (error) {
    return errorResult(error, "No se pudo crear la cuenta de tesorería.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

/**
 * @param {string} id_cuenta
 * @param {FormData} formData
 * @returns {Promise<{ ok: boolean, error: string | null, code?: string | null }>}
 */
export async function actualizarCuentaTesoreria(id_cuenta, formData) {
  if (!id_cuenta) {
    return {
      ok: false,
      code: null,
      error: "Falta el identificador de la cuenta de tesorería.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_cuenta_tesoreria_modificar", {
    p_id_cuenta: id_cuenta,
    p_nombre: texto(formData, "nombre_cuenta"),
    p_tipo: texto(formData, "tipo"),
    p_descripcion: texto(formData, "descripcion") || null,
  });

  if (error) {
    return errorResult(error, "No se pudo guardar la cuenta de tesorería.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

/**
 * @param {string} id_cuenta
 */
export async function habilitarCuentaTesoreria(id_cuenta) {
  if (!id_cuenta) {
    return {
      ok: false,
      code: null,
      error: "Falta el identificador de la cuenta de tesorería.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_cuenta_tesoreria_habilitar", {
    p_id_cuenta: id_cuenta,
  });

  if (error) {
    return errorResult(error, "No se pudo habilitar la cuenta de tesorería.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

/**
 * @param {string} id_cuenta
 */
export async function inhabilitarCuentaTesoreria(id_cuenta) {
  if (!id_cuenta) {
    return {
      ok: false,
      code: null,
      error: "Falta el identificador de la cuenta de tesorería.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_cuenta_tesoreria_inhabilitar", {
    p_id_cuenta: id_cuenta,
  });

  if (error) {
    return errorResult(error, "No se pudo inhabilitar la cuenta de tesorería.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}
