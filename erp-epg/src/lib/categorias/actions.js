"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIA_SELECT_CON_RUBRO } from "@/lib/categorias/types";
import { RUBRO_COLUMNS } from "@/lib/rubros/types";

const PATH = "/categorias";

/**
 * @param {FormData | { nombre_categoria?: string, id_rubro?: string, activo?: boolean | string }} input
 */
function parsePayload(input) {
  const get = (key) =>
    typeof input.get === "function" ? input.get(key) : input[key];

  const nombre = String(get("nombre_categoria") ?? "").trim();
  const id_rubro = String(get("id_rubro") ?? "").trim();

  const activoRaw = get("activo");
  const activo =
    activoRaw === true ||
    activoRaw === "true" ||
    activoRaw === "on" ||
    activoRaw === "1";

  return { nombre_categoria: nombre, id_rubro, activo };
}

/**
 * @param {{ nombre_categoria: string, id_rubro: string }} payload
 */
function validatePayload(payload) {
  if (!payload.id_rubro) {
    return "Debés seleccionar un rubro. Toda categoría debe estar asociada a un rubro.";
  }
  if (!payload.nombre_categoria || payload.nombre_categoria.length === 0) {
    return "El nombre de la categoría es obligatorio.";
  }
  return null;
}

function mensajeErrorSupabase(error, accion) {
  if (error?.code === "23505") {
    return "Ya existe una categoría con ese nombre en el rubro seleccionado.";
  }
  if (error?.code === "23503") {
    return "El rubro seleccionado no existe. Elegí un rubro válido.";
  }
  if (error?.code === "23502") {
    return "Debés seleccionar un rubro. Toda categoría debe estar asociada a un rubro.";
  }
  if (error?.code === "P0001" && typeof error?.message === "string") {
    return error.message;
  }
  if (
    typeof error?.message === "string" &&
    error.message.includes("artículos asociados")
  ) {
    return error.message;
  }
  return error?.message || `No se pudo ${accion} la categoría.`;
}

/**
 * Rubros disponibles para el selector (preferencia: activos).
 * @returns {Promise<{ data: import('@/lib/rubros/types').Rubro[] | null, error: string | null }>}
 */
export async function listarRubrosParaCategoria() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rubro")
    .select(RUBRO_COLUMNS)
    .eq("activo", true)
    .order("nombre_rubro", { ascending: true });

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data ?? [], error: null };
}

/**
 * @returns {Promise<{ data: import('@/lib/categorias/types').Categoria[] | null, error: string | null }>}
 */
export async function listarCategorias() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categoria")
    .select(CATEGORIA_SELECT_CON_RUBRO)
    .order("id_rubro", { ascending: true })
    .order("nombre_categoria", { ascending: true });

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data ?? [], error: null };
}

/**
 * @param {string} id_categoria
 */
export async function obtenerCategoria(id_categoria) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categoria")
    .select(CATEGORIA_SELECT_CON_RUBRO)
    .eq("id_categoria", id_categoria)
    .maybeSingle();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

/**
 * @param {string} id_categoria
 * @returns {Promise<{ motivo: string | null, error: string | null }>}
 */
async function motivoBloqueoDelete(id_categoria) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "categoria_motivo_bloqueo_delete",
    { p_id_categoria: id_categoria }
  );

  if (error) {
    if (
      error.code === "PGRST202" ||
      error.message?.includes("Could not find the function")
    ) {
      return { motivo: null, error: null };
    }
    return { motivo: null, error: error.message };
  }

  return { motivo: data ?? null, error: null };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} id_rubro
 * @param {{ permitirInactivo?: boolean }} [opts]
 */
async function validarRubroAsociado(supabase, id_rubro, opts = {}) {
  const { data, error } = await supabase
    .from("rubro")
    .select("id_rubro, activo")
    .eq("id_rubro", id_rubro)
    .maybeSingle();

  if (error) {
    return error.message;
  }
  if (!data) {
    return "El rubro seleccionado no existe. Elegí un rubro válido.";
  }
  if (!opts.permitirInactivo && !data.activo) {
    return "El rubro seleccionado está inactivo. Elegí un rubro activo.";
  }
  return null;
}

/**
 * @param {FormData} formData
 */
export async function crearCategoria(formData) {
  const payload = parsePayload(formData);
  const validationError = validatePayload(payload);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  const supabase = await createClient();
  const rubroError = await validarRubroAsociado(supabase, payload.id_rubro);
  if (rubroError) {
    return { ok: false, error: rubroError };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  /** @type {Record<string, unknown>} */
  const row = {
    nombre_categoria: payload.nombre_categoria,
    id_rubro: payload.id_rubro,
    activo: payload.activo,
  };
  if (user?.email || user?.id) {
    row.creado_por = user.email ?? user.id;
  }

  const { error } = await supabase.from("categoria").insert(row);

  if (error) {
    return { ok: false, error: mensajeErrorSupabase(error, "crear") };
  }

  revalidatePath(PATH);
  return { ok: true, error: null };
}

/**
 * @param {string} id_categoria
 * @param {FormData} formData
 */
export async function actualizarCategoria(id_categoria, formData) {
  if (!id_categoria) {
    return { ok: false, error: "Falta el identificador de la categoría." };
  }

  const payload = parsePayload(formData);
  const validationError = validatePayload(payload);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  const supabase = await createClient();

  // Si cambia de rubro, el destino debe estar activo. Si mantiene el mismo
  // (aunque esté inactivo), se permite para no bloquear ediciones de nombre.
  const { data: actual } = await supabase
    .from("categoria")
    .select("id_rubro")
    .eq("id_categoria", id_categoria)
    .maybeSingle();

  const cambiaRubro = actual?.id_rubro !== payload.id_rubro;
  const rubroError = await validarRubroAsociado(supabase, payload.id_rubro, {
    permitirInactivo: !cambiaRubro,
  });
  if (rubroError) {
    return { ok: false, error: rubroError };
  }

  const { error } = await supabase
    .from("categoria")
    .update({
      nombre_categoria: payload.nombre_categoria,
      id_rubro: payload.id_rubro,
      activo: payload.activo,
    })
    .eq("id_categoria", id_categoria);

  if (error) {
    return { ok: false, error: mensajeErrorSupabase(error, "actualizar") };
  }

  revalidatePath(PATH);
  revalidatePath(`${PATH}/${id_categoria}/editar`);
  return { ok: true, error: null };
}

/**
 * @param {string} id_categoria
 * @param {boolean} activo
 */
export async function setActivoCategoria(id_categoria, activo) {
  if (!id_categoria) {
    return { ok: false, error: "Falta el identificador de la categoría." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("categoria")
    .update({ activo: Boolean(activo) })
    .eq("id_categoria", id_categoria);

  if (error) {
    return { ok: false, error: mensajeErrorSupabase(error, "actualizar") };
  }

  revalidatePath(PATH);
  return { ok: true, error: null };
}

/**
 * @param {string} id_categoria
 */
export async function eliminarCategoria(id_categoria) {
  if (!id_categoria) {
    return { ok: false, error: "Falta el identificador de la categoría." };
  }

  const chequeo = await motivoBloqueoDelete(id_categoria);
  if (chequeo.error) {
    return { ok: false, error: chequeo.error };
  }
  if (chequeo.motivo) {
    return { ok: false, error: chequeo.motivo };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("categoria")
    .delete()
    .eq("id_categoria", id_categoria);

  if (error) {
    return { ok: false, error: mensajeErrorSupabase(error, "eliminar") };
  }

  revalidatePath(PATH);
  return { ok: true, error: null };
}
