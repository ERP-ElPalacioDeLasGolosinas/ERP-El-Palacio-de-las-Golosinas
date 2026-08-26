"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PRODUCTO_SELECT_CON_RELACIONES } from "@/lib/productos/types";

const PATH = "/productos";

/**
 * @param {FormData} formData
 */
function parsePayload(formData) {
  const get = (key) => String(formData.get(key) ?? "").trim();

  const parsePrecio = (key) => {
    const raw = get(key);
    if (raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : NaN;
  };

  return {
    codigo_producto: get("codigo_producto"),
    nombre_producto: get("nombre_producto"),
    descripcion_producto: get("descripcion_producto"),
    id_marca: get("id_marca"),
    id_unidad_medida: get("id_unidad_medida"),
    id_categoria: get("id_categoria"),
    precio_costo_producto: parsePrecio("precio_costo_producto"),
    precio_venta_mayorista_producto: parsePrecio(
      "precio_venta_mayorista_producto"
    ),
    precio_venta_sugerido_producto: parsePrecio(
      "precio_venta_sugerido_producto"
    ),
  };
}

/**
 * @param {ReturnType<typeof parsePayload>} payload
 */
function validatePayload(payload) {
  if (!payload.codigo_producto) {
    return "El código del artículo es obligatorio.";
  }
  if (!payload.nombre_producto) {
    return "El nombre del artículo es obligatorio.";
  }
  if (!payload.descripcion_producto) {
    return "La descripción del artículo es obligatoria.";
  }
  if (!payload.id_marca) {
    return "Debés seleccionar una marca.";
  }
  if (!payload.id_unidad_medida) {
    return "Debés seleccionar una unidad de medida.";
  }
  if (!payload.id_categoria) {
    return "Debés seleccionar una categoría.";
  }
  if (
    payload.precio_costo_producto === null ||
    Number.isNaN(payload.precio_costo_producto)
  ) {
    return "El precio de costo es obligatorio y debe ser un número válido.";
  }
  if (payload.precio_costo_producto < 0) {
    return "El precio de costo no puede ser negativo.";
  }
  if (Number.isNaN(payload.precio_venta_mayorista_producto)) {
    return "El precio de venta mayorista debe ser un número válido.";
  }
  if (
    payload.precio_venta_mayorista_producto !== null &&
    payload.precio_venta_mayorista_producto < 0
  ) {
    return "El precio de venta mayorista no puede ser negativo.";
  }
  if (Number.isNaN(payload.precio_venta_sugerido_producto)) {
    return "El precio de venta sugerido debe ser un número válido.";
  }
  if (
    payload.precio_venta_sugerido_producto !== null &&
    payload.precio_venta_sugerido_producto < 0
  ) {
    return "El precio de venta sugerido no puede ser negativo.";
  }
  return null;
}

function mensajeErrorSupabase(error, accion) {
  if (error?.code === "23505") {
    return "Ya existe un artículo con ese código.";
  }
  if (error?.code === "23503") {
    return "La marca, unidad de medida o categoría seleccionada no existe.";
  }
  if (error?.code === "23502") {
    return "Faltan campos obligatorios para registrar el artículo.";
  }
  if (error?.code === "23514") {
    return "Revisá los datos: hay un campo obligatorio vacío o un precio inválido.";
  }
  return error?.message || `No se pudo ${accion} el artículo.`;
}

/**
 * Marcas activas para el selector del alta.
 */
export async function listarMarcasParaProducto() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("marca")
    .select("id_marca, nombre_marca, activo")
    .eq("activo", true)
    .order("nombre_marca", { ascending: true });

  if (error) return { data: null, error: error.message };
  return { data: data ?? [], error: null };
}

/**
 * Unidades de medida activas para el selector del alta.
 */
export async function listarUnidadesMedidaParaProducto() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("unidad_medida")
    .select("id_unidad_medida, nombre_unidad_medida, abreviatura_unidad_medida, activo")
    .eq("activo", true)
    .order("nombre_unidad_medida", { ascending: true });

  if (error) return { data: null, error: error.message };
  return { data: data ?? [], error: null };
}

/**
 * Rubros y categorías activos para el selector en cascada del alta.
 * Se listan juntos: cada categoría trae su rubro embebido.
 */
export async function listarCategoriasParaProducto() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categoria")
    .select(
      "id_categoria, nombre_categoria, activo, id_rubro, rubro:id_rubro ( id_rubro, nombre_rubro, activo )"
    )
    .eq("activo", true)
    .order("nombre_categoria", { ascending: true });

  if (error) return { data: null, error: error.message };
  return { data: data ?? [], error: null };
}

/**
 * @returns {Promise<{ data: import('@/lib/productos/types').Producto[] | null, error: string | null }>}
 */
export async function listarProductos() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("producto")
    .select(PRODUCTO_SELECT_CON_RELACIONES)
    .order("nombre_producto", { ascending: true });

  if (error) return { data: null, error: error.message };
  return { data: data ?? [], error: null };
}

/**
 * @param {FormData} formData
 */
export async function crearProducto(_prevState, formData) {
  const payload = parsePayload(formData);
  const validationError = validatePayload(payload);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  /** @type {Record<string, unknown>} */
  const row = {
    codigo_producto: payload.codigo_producto,
    nombre_producto: payload.nombre_producto,
    descripcion_producto: payload.descripcion_producto,
    id_marca: payload.id_marca,
    id_unidad_medida: payload.id_unidad_medida,
    id_categoria: payload.id_categoria,
    precio_costo_producto: payload.precio_costo_producto,
    precio_venta_mayorista_producto: payload.precio_venta_mayorista_producto,
    precio_venta_sugerido_producto: payload.precio_venta_sugerido_producto,
  };
  if (user?.email || user?.id) {
    row.creado_por = user.email ?? user.id;
  }

  const { error } = await supabase.from("producto").insert(row);

  if (error) {
    return { ok: false, error: mensajeErrorSupabase(error, "crear") };
  }

  revalidatePath(PATH);
  return { ok: true, error: null };
}
