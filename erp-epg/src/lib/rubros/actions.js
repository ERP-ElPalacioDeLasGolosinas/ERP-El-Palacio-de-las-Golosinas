"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { RUBRO_COLUMNS } from "@/lib/rubros/types";

const PATH = "/rubros";

/**
 * @param {FormData | { nombre_rubro?: string, activo?: boolean | string }} input
 */
function parsePayload(input) {
  const get = (key) =>
    typeof input.get === "function" ? input.get(key) : input[key];

  const nombre = String(get("nombre_rubro") ?? "").trim();

  const activoRaw = get("activo");
  const activo =
    activoRaw === true ||
    activoRaw === "true" ||
    activoRaw === "on" ||
    activoRaw === "1";

  return { nombre_rubro: nombre, activo };
}

function validateNombre(nombre) {
  if (!nombre || nombre.length === 0) {
    return "El nombre del rubro es obligatorio.";
  }
  return null;
}

function mensajeErrorSupabase(error, accion) {
  if (error?.code === "23505") {
    return "Ya existe un rubro con ese nombre.";
  }
  if (error?.code === "P0001" && typeof error?.message === "string") {
    return error.message;
  }
  if (
    typeof error?.message === "string" &&
    (error.message.includes("artículos activos") ||
      error.message.includes("categorías asociadas"))
  ) {
    return error.message;
  }
  return error?.message || `No se pudo ${accion} el rubro.`;
}

/**
 * @returns {Promise<{ data: import('@/lib/rubros/types').Rubro[] | null, error: string | null }>}
 */
export async function listarRubros() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rubro")
    .select(RUBRO_COLUMNS)
    .order("nombre_rubro", { ascending: true });

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data ?? [], error: null };
}

/**
 * @param {string} id_rubro
 */
export async function obtenerRubro(id_rubro) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rubro")
    .select(RUBRO_COLUMNS)
    .eq("id_rubro", id_rubro)
    .maybeSingle();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

/**
 * @param {string} id_rubro
 * @returns {Promise<{ motivo: string | null, error: string | null }>}
 */
async function motivoBloqueoDelete(id_rubro) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rubro_motivo_bloqueo_delete", {
    p_id_rubro: id_rubro,
  });

  if (error) {
    // Migración aún no aplicada / RPC vieja: caer a la RPC booleana.
    if (
      error.code === "PGRST202" ||
      error.message?.includes("Could not find the function")
    ) {
      const legacy = await supabase.rpc("rubro_tiene_articulos_activos", {
        p_id_rubro: id_rubro,
      });
      if (legacy.error) {
        if (
          legacy.error.code === "PGRST202" ||
          legacy.error.message?.includes("Could not find the function")
        ) {
          return { motivo: null, error: null };
        }
        return { motivo: null, error: legacy.error.message };
      }
      return {
        motivo: legacy.data
          ? "No se puede eliminar el rubro porque tiene artículos activos asociados."
          : null,
        error: null,
      };
    }
    return { motivo: null, error: error.message };
  }

  return { motivo: data ?? null, error: null };
}

/**
 * @param {FormData} formData
 */
export async function crearRubro(formData) {
  const payload = parsePayload(formData);
  const validationError = validateNombre(payload.nombre_rubro);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  /** @type {Record<string, unknown>} */
  const row = {
    nombre_rubro: payload.nombre_rubro,
    activo: payload.activo,
  };
  // Solo setear creado_por si hay sesión; si no, aplica el DEFAULT de la migración.
  if (user?.email || user?.id) {
    row.creado_por = user.email ?? user.id;
  }

  const { error } = await supabase.from("rubro").insert(row);

  if (error) {
    return { ok: false, error: mensajeErrorSupabase(error, "crear") };
  }

  revalidatePath(PATH);
  return { ok: true, error: null };
}

/**
 * @param {string} id_rubro
 * @param {FormData} formData
 */
export async function actualizarRubro(id_rubro, formData) {
  if (!id_rubro) {
    return { ok: false, error: "Falta el identificador del rubro." };
  }

  const payload = parsePayload(formData);
  const validationError = validateNombre(payload.nombre_rubro);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("rubro")
    .update({
      nombre_rubro: payload.nombre_rubro,
      activo: payload.activo,
    })
    .eq("id_rubro", id_rubro);

  if (error) {
    return { ok: false, error: mensajeErrorSupabase(error, "actualizar") };
  }

  revalidatePath(PATH);
  revalidatePath(`${PATH}/${id_rubro}/editar`);
  return { ok: true, error: null };
}

/**
 * @param {string} id_rubro
 * @param {boolean} activo
 */
export async function setActivoRubro(id_rubro, activo) {
  if (!id_rubro) {
    return { ok: false, error: "Falta el identificador del rubro." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("rubro")
    .update({ activo: Boolean(activo) })
    .eq("id_rubro", id_rubro);

  if (error) {
    return { ok: false, error: mensajeErrorSupabase(error, "actualizar") };
  }

  revalidatePath(PATH);
  return { ok: true, error: null };
}

/**
 * @param {string} id_rubro
 */
export async function eliminarRubro(id_rubro) {
  if (!id_rubro) {
    return { ok: false, error: "Falta el identificador del rubro." };
  }

  const chequeo = await motivoBloqueoDelete(id_rubro);
  if (chequeo.error) {
    return { ok: false, error: chequeo.error };
  }
  if (chequeo.motivo) {
    return { ok: false, error: chequeo.motivo };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("rubro")
    .delete()
    .eq("id_rubro", id_rubro);

  if (error) {
    return { ok: false, error: mensajeErrorSupabase(error, "eliminar") };
  }

  revalidatePath(PATH);
  return { ok: true, error: null };
}
