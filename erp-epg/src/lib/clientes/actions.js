"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const PATH = "/ventas/clientes";

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

/** Vacío → null (mail / dirección opcionales). */
function textoOpcional(input, key) {
  const value = texto(input, key);
  return value.length > 0 ? value : null;
}

/**
 * Lista clientes vía `fn_cliente_listar`.
 *
 * @param {boolean} [incluirInactivos=true]
 */
export async function listarClientes(incluirInactivos = true) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_cliente_listar", {
    p_incluir_inactivos: Boolean(incluirInactivos),
  });

  if (error) {
    return { data: null, error: "No se pudieron cargar los clientes." };
  }

  return { data: data ?? [], error: null };
}

/**
 * @param {FormData} formData
 */
export async function crearCliente(formData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      code: null,
      error: "Debés iniciar sesión para crear un cliente.",
    };
  }

  const { error } = await supabase.rpc("fn_cliente_crear", {
    p_nombre_cliente: texto(formData, "nombre_cliente"),
    p_id_tipo_cliente: texto(formData, "id_tipo_cliente") || null,
    p_documento_cliente: texto(formData, "documento_cliente"),
    p_telefono_cliente: texto(formData, "telefono_cliente"),
    p_creado_por: user.id,
    p_mail_cliente: textoOpcional(formData, "mail_cliente"),
    p_direccion_cliente: textoOpcional(formData, "direccion_cliente"),
  });

  if (error) {
    return errorResult(error, "No se pudo crear el cliente.");
  }

  revalidatePath(PATH);
  revalidatePath("/ventas/tipos-de-cliente");
  return { ok: true, error: null, code: null };
}

/**
 * @param {string} id_cliente
 * @param {FormData} formData
 */
export async function actualizarCliente(id_cliente, formData) {
  if (!id_cliente) {
    return {
      ok: false,
      code: null,
      error: "Falta el identificador del cliente.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_cliente_modificar", {
    p_id_cliente: id_cliente,
    p_nombre_cliente: texto(formData, "nombre_cliente"),
    p_id_tipo_cliente: texto(formData, "id_tipo_cliente") || null,
    p_documento_cliente: texto(formData, "documento_cliente"),
    p_telefono_cliente: texto(formData, "telefono_cliente"),
    p_mail_cliente: textoOpcional(formData, "mail_cliente"),
    p_direccion_cliente: textoOpcional(formData, "direccion_cliente"),
  });

  if (error) {
    return errorResult(error, "No se pudo guardar el cliente.");
  }

  revalidatePath(PATH);
  revalidatePath("/ventas/tipos-de-cliente");
  return { ok: true, error: null, code: null };
}

/**
 * @param {string} id_cliente
 */
export async function habilitarCliente(id_cliente) {
  if (!id_cliente) {
    return {
      ok: false,
      code: null,
      error: "Falta el identificador del cliente.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_cliente_habilitar", {
    p_id_cliente: id_cliente,
  });

  if (error) {
    return errorResult(error, "No se pudo habilitar el cliente.");
  }

  revalidatePath(PATH);
  revalidatePath("/ventas/tipos-de-cliente");
  return { ok: true, error: null, code: null };
}

/**
 * @param {string} id_cliente
 */
export async function inhabilitarCliente(id_cliente) {
  if (!id_cliente) {
    return {
      ok: false,
      code: null,
      error: "Falta el identificador del cliente.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_cliente_inhabilitar", {
    p_id_cliente: id_cliente,
  });

  if (error) {
    return errorResult(error, "No se pudo inhabilitar el cliente.");
  }

  revalidatePath(PATH);
  revalidatePath("/ventas/tipos-de-cliente");
  return { ok: true, error: null, code: null };
}
