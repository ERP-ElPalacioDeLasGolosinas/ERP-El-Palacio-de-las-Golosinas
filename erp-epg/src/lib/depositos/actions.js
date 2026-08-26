"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEPOSITO_COLUMNS } from "@/lib/depositos/types";

const PATH = "/deposito";

/**
 * @param {FormData | Record<string, unknown>} input
 */
function parsePayload(input) {
  const get = (key) =>
    typeof input.get === "function" ? input.get(key) : input[key];
  const optionalText = (key) => {
    const value = get(key);
    if (value == null || String(value).trim() === "") {
      return null;
    }
    return String(value).trim();
  };

  const nombre = String(get("nombre_deposito") ?? "").trim();
  const direccion = optionalText("direccion_deposito");
  const telefono = optionalText("telefono_deposito");
  const horarioApertura = optionalText("horario_apertura");
  const horarioCierre = optionalText("horario_cierre");
  const idResponsable = optionalText("id_responsable");

  const activoRaw = get("activo");
  const activo =
    activoRaw === true ||
    activoRaw === "true" ||
    activoRaw === "on" ||
    activoRaw === "1";
  const estaLlenoRaw = get("esta_lleno");
  const estaLleno =
    estaLlenoRaw === true ||
    estaLlenoRaw === "true" ||
    estaLlenoRaw === "on" ||
    estaLlenoRaw === "1";

  return {
    nombre_deposito: nombre,
    direccion_deposito: direccion,
    telefono_deposito: telefono,
    horario_apertura: horarioApertura,
    horario_cierre: horarioCierre,
    id_responsable: idResponsable,
    activo,
    esta_lleno: estaLleno,
  };
}

const CAMPOS_OBLIGATORIOS = [
  ["nombre_deposito", "Nombre"],
  ["telefono_deposito", "Teléfono"],
  ["direccion_deposito", "Dirección"],
  ["horario_apertura", "Horario de apertura"],
  ["horario_cierre", "Horario de cierre"],
  ["id_responsable", "Responsable"],
];

const NOMBRES_COLUMNA = Object.fromEntries(CAMPOS_OBLIGATORIOS);

function validatePayload(payload) {
  const faltantes = CAMPOS_OBLIGATORIOS.filter(([key]) => !payload[key]).map(
    ([, label]) => label
  );

  if (faltantes.length === 0) {
    return null;
  }

  return `Falta completar: ${faltantes.join(", ")}`;
}

function mensajeErrorGuardado(error) {
  if (error?.code === "23505") {
    return "Ya existe un depósito con ese nombre.";
  }

  const columna = error?.message?.match(/column "([^"]+)"/)?.[1];
  const campo = columna ? NOMBRES_COLUMNA[columna] : null;
  if (campo && /null value|not-null|not null/i.test(error.message ?? "")) {
    return `Falta completar: ${campo}`;
  }

  return "No se pudo guardar el depósito. Revisá los datos e intentá de nuevo.";
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
    return { data: null, error: "No se pudieron cargar los depósitos." };
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
    return { data: null, error: "No se pudo cargar el depósito." };
  }

  return { data, error: null };
}

/**
 * @param {FormData} formData
 */
export async function crearDeposito(formData) {
  const payload = parsePayload(formData);
  const validationError = validatePayload(payload);
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
    telefono_deposito: payload.telefono_deposito,
    horario_apertura: payload.horario_apertura,
    horario_cierre: payload.horario_cierre,
    id_responsable: payload.id_responsable,
    activo: payload.activo,
    esta_lleno: payload.esta_lleno,
    creado_por: user?.email ?? user?.id ?? null,
  });

  if (error) {
    return { ok: false, error: mensajeErrorGuardado(error) };
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
  const validationError = validatePayload(payload);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("deposito")
    .update({
      nombre_deposito: payload.nombre_deposito,
      direccion_deposito: payload.direccion_deposito,
      telefono_deposito: payload.telefono_deposito,
      horario_apertura: payload.horario_apertura,
      horario_cierre: payload.horario_cierre,
      id_responsable: payload.id_responsable,
      activo: payload.activo,
      esta_lleno: payload.esta_lleno,
    })
    .eq("id_deposito", id_deposito);

  if (error) {
    return { ok: false, error: mensajeErrorGuardado(error) };
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
    return { ok: false, error: "No se pudo actualizar el estado del depósito." };
  }

  revalidatePath(PATH);
  return { ok: true, error: null };
}

/**
 * @param {string} id_deposito
 * @param {boolean} esta_lleno
 */
export async function setEstaLlenoDeposito(id_deposito, esta_lleno) {
  if (!id_deposito) {
    return { ok: false, error: "Falta el identificador del depósito." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("deposito")
    .update({ esta_lleno: Boolean(esta_lleno) })
    .eq("id_deposito", id_deposito);

  if (error) {
    return {
      ok: false,
      error: "No se pudo actualizar la capacidad del depósito.",
    };
  }

  revalidatePath(PATH);
  return { ok: true, error: null };
}

/**
 * @param {string} id_deposito
 */
export async function eliminarDeposito(id_deposito) {
  if (!id_deposito) {
    return { ok: false, error: "Falta el identificador del depósito." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("deposito")
    .delete()
    .eq("id_deposito", id_deposito);

  if (error) {
    return {
      ok: false,
      error:
        "No se pudo eliminar el depósito. Verificá que no tenga lotes o movimientos asociados.",
    };
  }

  revalidatePath(PATH);
  return { ok: true, error: null };
}
