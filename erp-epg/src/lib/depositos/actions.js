"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEPOSITO_COLUMNS } from "@/lib/depositos/types";

const PATH = "/depositos";

/**
 * @param {FormData | { nombre_deposito?: string, direccion_deposito?: string, activo?: boolean | string }} input
 */
function parsePayload(input) {
  const get = (key) =>
    typeof input.get === "function" ? input.get(key) : input[key];

  const nombre = String(get("nombre_deposito") ?? "").trim();
  const direccionRaw = get("direccion_deposito");
  const direccion =
    direccionRaw == null || String(direccionRaw).trim() === ""
      ? null
      : String(direccionRaw).trim();

  // Checkbox HTML: si no viene en FormData, está desmarcado → false.
  const activoRaw = get("activo");
  const activo =
    activoRaw === true ||
    activoRaw === "true" ||
    activoRaw === "on" ||
    activoRaw === "1";

  return { nombre_deposito: nombre, direccion_deposito: direccion, activo };
}

function validateNombre(nombre) {
  if (!nombre || nombre.length === 0) {
    return "El nombre del depósito es obligatorio.";
  }
  return null;
}

/**
 * @returns {Promise<{ data: import('@/lib/depositos/types').Deposito[] | null, error: string | null }>}
 */
export async function listarDepositos() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deposito")
    .select(DEPOSITO_COLUMNS)
    .order("nombre_deposito", { ascending: true });

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data ?? [], error: null };
}

/**
 * @param {string} id_deposito
 */
export async function obtenerDeposito(id_deposito) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deposito")
    .select(DEPOSITO_COLUMNS)
    .eq("id_deposito", id_deposito)
    .maybeSingle();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

/**
 * @param {FormData} formData
 */
export async function crearDeposito(formData) {
  const payload = parsePayload(formData);
  const validationError = validateNombre(payload.nombre_deposito);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("deposito").insert({
    nombre_deposito: payload.nombre_deposito,
    direccion_deposito: payload.direccion_deposito,
    activo: payload.activo,
    creado_por: user?.email ?? user?.id ?? null,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Ya existe un depósito con ese nombre." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath(PATH);
  return { ok: true, error: null };
}

/**
 * @param {string} id_deposito
 * @param {FormData} formData
 */
export async function actualizarDeposito(id_deposito, formData) {
  if (!id_deposito) {
    return { ok: false, error: "Falta el identificador del depósito." };
  }

  const payload = parsePayload(formData);
  const validationError = validateNombre(payload.nombre_deposito);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("deposito")
    .update({
      nombre_deposito: payload.nombre_deposito,
      direccion_deposito: payload.direccion_deposito,
      activo: payload.activo,
    })
    .eq("id_deposito", id_deposito);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Ya existe un depósito con ese nombre." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath(PATH);
  revalidatePath(`${PATH}/${id_deposito}/editar`);
  return { ok: true, error: null };
}

/**
 * @param {string} id_deposito
 * @param {boolean} activo
 */
export async function setActivoDeposito(id_deposito, activo) {
  if (!id_deposito) {
    return { ok: false, error: "Falta el identificador del depósito." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("deposito")
    .update({ activo: Boolean(activo) })
    .eq("id_deposito", id_deposito);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(PATH);
  return { ok: true, error: null };
}
