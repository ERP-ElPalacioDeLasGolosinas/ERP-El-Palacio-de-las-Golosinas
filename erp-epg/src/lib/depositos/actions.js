"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const PATH = "/inventario/depositos";
const DEPOSITO_COLUMNS =
  "id_deposito, nombre_deposito, direccion_deposito, telefono_deposito, horario_apertura, horario_cierre, id_responsable, activo, esta_lleno, creado, editado, creado_por";

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

  const activoRaw = get("activo");
  const estaLlenoRaw = get("esta_lleno");

  return {
    nombre_deposito: String(get("nombre_deposito") ?? "").trim(),
    direccion_deposito: optionalText("direccion_deposito"),
    telefono_deposito: optionalText("telefono_deposito"),
    horario_apertura: optionalText("horario_apertura"),
    horario_cierre: optionalText("horario_cierre"),
    id_responsable: optionalText("id_responsable"),
    activo:
      activoRaw === true ||
      activoRaw === "true" ||
      activoRaw === "on" ||
      activoRaw === "1",
    esta_lleno:
      estaLlenoRaw === true ||
      estaLlenoRaw === "true" ||
      estaLlenoRaw === "on" ||
      estaLlenoRaw === "1",
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
const ERRORES_RPC_EN_ESPANOL = [
  "Falta completar:",
  "Debés iniciar sesión",
  "No se encontró el depósito indicado.",
];

function validatePayload(payload) {
  const faltantes = CAMPOS_OBLIGATORIOS.filter(([key]) => !payload[key]).map(
    ([, label]) => label
  );

  if (faltantes.length > 0) {
    return `Falta completar: ${faltantes.join(", ")}`;
  }

  return null;
}

function mensajeErrorGuardado(error) {
  if (!error?.message) {
    return "No se pudo guardar el depósito. Revisá los datos e intentá de nuevo.";
  }

  if (ERRORES_RPC_EN_ESPANOL.some((texto) => error.message.includes(texto))) {
    return error.message;
  }

  if (error.code === "23505") {
    return "Ya existe un depósito con ese nombre.";
  }

  const columna = error.message.match(/column "([^"]+)"/)?.[1];
  const campo = columna ? NOMBRES_COLUMNA[columna] : null;
  if (campo && /null value|not-null|not null/i.test(error.message)) {
    return `Falta completar: ${campo}`;
  }

  return "No se pudo guardar el depósito. Revisá los datos e intentá de nuevo.";
}

function mensajeErrorSimple(error, mensajePorDefecto) {
  if (error?.message) {
    return error.message;
  }

  return mensajePorDefecto;
}

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
  const { error } = await supabase.rpc("crear_deposito", {
    p_nombre_deposito: payload.nombre_deposito,
    p_direccion_deposito: payload.direccion_deposito,
    p_telefono_deposito: payload.telefono_deposito,
    p_horario_apertura: payload.horario_apertura,
    p_horario_cierre: payload.horario_cierre,
    p_id_responsable: payload.id_responsable,
    p_activo: payload.activo,
    p_esta_lleno: payload.esta_lleno,
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
  const { error } = await supabase.rpc("actualizar_deposito", {
    p_id_deposito: id_deposito,
    p_nombre_deposito: payload.nombre_deposito,
    p_direccion_deposito: payload.direccion_deposito,
    p_telefono_deposito: payload.telefono_deposito,
    p_horario_apertura: payload.horario_apertura,
    p_horario_cierre: payload.horario_cierre,
    p_id_responsable: payload.id_responsable,
    p_activo: payload.activo,
    p_esta_lleno: payload.esta_lleno,
  });

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
  const { error } = await supabase.rpc("set_activo_deposito", {
    p_id_deposito: id_deposito,
    p_activo: Boolean(activo),
  });

  if (error) {
    return {
      ok: false,
      error: mensajeErrorSimple(
        error,
        "No se pudo actualizar el estado del depósito."
      ),
    };
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
  const { error } = await supabase.rpc("set_esta_lleno_deposito", {
    p_id_deposito: id_deposito,
    p_esta_lleno: Boolean(esta_lleno),
  });

  if (error) {
    return {
      ok: false,
      error: mensajeErrorSimple(
        error,
        "No se pudo actualizar la capacidad del depósito."
      ),
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
  const { error } = await supabase.rpc("eliminar_deposito", {
    p_id_deposito: id_deposito,
  });

  if (error) {
    return {
      ok: false,
      error: mensajeErrorSimple(error, "No se pudo eliminar el depósito."),
    };
  }

  revalidatePath(PATH);
  return { ok: true, error: null };
}
