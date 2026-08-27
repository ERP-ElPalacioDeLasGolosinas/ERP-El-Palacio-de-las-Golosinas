"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const PATH = "/inventario/depositos";
const DEPOSITO_COLUMNS =
  "id_deposito, nombre_deposito, direccion_deposito, telefono_deposito, horario_apertura, horario_cierre, id_responsable, activo, esta_lleno, creado, editado, creado_por";

/**
 * Junta los parámetros del formulario. Las reglas de negocio (obligatorios,
 * formato de horario, nombre duplicado, etc.) las valida cada función
 * `fn_deposito_*` en Supabase, así que acá no se valida nada.
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

  return {
    nombre_deposito: optionalText("nombre_deposito"),
    direccion_deposito: optionalText("direccion_deposito"),
    telefono_deposito: optionalText("telefono_deposito"),
    horario_apertura: optionalText("horario_apertura"),
    horario_cierre: optionalText("horario_cierre"),
    id_responsable: optionalText("id_responsable"),
  };
}

/**
 * Los mensajes de las funciones ya vienen en español y listos para mostrar.
 * @param {{ message?: string } | null} error
 * @param {string} mensajePorDefecto
 */
function mensajeError(error, mensajePorDefecto) {
  return error?.message || mensajePorDefecto;
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
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Debés iniciar sesión para crear un depósito." };
  }

  const { error } = await supabase.rpc("fn_deposito_crear", {
    p_nombre_deposito: payload.nombre_deposito,
    p_direccion_deposito: payload.direccion_deposito,
    p_telefono_deposito: payload.telefono_deposito,
    p_horario_apertura: payload.horario_apertura,
    p_horario_cierre: payload.horario_cierre,
    p_creado_por: user.id,
    p_id_responsable: payload.id_responsable,
  });

  if (error) {
    return { ok: false, error: mensajeError(error, "No se pudo crear el depósito.") };
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
  const supabase = await createClient();

  const { error } = await supabase.rpc("fn_deposito_modificar", {
    p_id_deposito: id_deposito,
    p_nombre_deposito: payload.nombre_deposito,
    p_direccion_deposito: payload.direccion_deposito,
    p_telefono_deposito: payload.telefono_deposito,
    p_horario_apertura: payload.horario_apertura,
    p_horario_cierre: payload.horario_cierre,
    p_id_responsable: payload.id_responsable,
  });

  if (error) {
    return {
      ok: false,
      error: mensajeError(error, "No se pudo guardar el depósito."),
    };
  }

  revalidatePath(PATH);
  revalidatePath(`${PATH}/${id_deposito}/editar`);
  return { ok: true, error: null };
}

/**
 * @param {string} id_deposito
 */
export async function habilitarDeposito(id_deposito) {
  if (!id_deposito) {
    return { ok: false, error: "Falta el identificador del depósito." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_deposito_habilitar", {
    p_id_deposito: id_deposito,
  });

  if (error) {
    return {
      ok: false,
      error: mensajeError(error, "No se pudo habilitar el depósito."),
    };
  }

  revalidatePath(PATH);
  return { ok: true, error: null };
}

/**
 * @param {string} id_deposito
 */
export async function inhabilitarDeposito(id_deposito) {
  if (!id_deposito) {
    return { ok: false, error: "Falta el identificador del depósito." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_deposito_inhabilitar", {
    p_id_deposito: id_deposito,
  });

  if (error) {
    return {
      ok: false,
      error: mensajeError(error, "No se pudo inhabilitar el depósito."),
    };
  }

  revalidatePath(PATH);
  return { ok: true, error: null };
}

/**
 * @param {string} id_deposito
 */
export async function marcarLlenoDeposito(id_deposito) {
  if (!id_deposito) {
    return { ok: false, error: "Falta el identificador del depósito." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_deposito_marcar_lleno", {
    p_id_deposito: id_deposito,
  });

  if (error) {
    return {
      ok: false,
      error: mensajeError(error, "No se pudo marcar el depósito como lleno."),
    };
  }

  revalidatePath(PATH);
  return { ok: true, error: null };
}

/**
 * @param {string} id_deposito
 */
export async function desmarcarLlenoDeposito(id_deposito) {
  if (!id_deposito) {
    return { ok: false, error: "Falta el identificador del depósito." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_deposito_desmarcar_lleno", {
    p_id_deposito: id_deposito,
  });

  if (error) {
    return {
      ok: false,
      error: mensajeError(error, "No se pudo marcar el depósito como disponible."),
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
  const { error } = await supabase.rpc("fn_deposito_eliminar", {
    p_id_deposito: id_deposito,
  });

  if (error) {
    return {
      ok: false,
      error: mensajeError(error, "No se pudo eliminar el depósito."),
    };
  }

  revalidatePath(PATH);
  return { ok: true, error: null };
}
