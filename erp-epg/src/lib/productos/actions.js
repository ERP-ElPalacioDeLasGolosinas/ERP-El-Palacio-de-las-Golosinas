"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const PATH = "/inventario/productos";

/**
 * Propaga el `code` (ERRCODE custom PRD01..PRD09) y el `message` del RPC (ya en
 * español), con un fallback.
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
 * Devuelve un número o `null` si el campo está vacío / no es numérico.
 * @param {FormData | Record<string, unknown>} input
 * @param {string} key
 */
function numero(input, key) {
  const raw = texto(input, key);
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Lista productos vía RPC `fn_producto_listar`. Cada fila trae `nombre_completo`
 * ya armado, los campos sueltos, `nombre_marca` / `nombre_categoria` /
 * `nombre_rubro` (JOINs) y `creado_por_nombre` (LEFT JOIN vw_usuario_resumen).
 *
 * @param {boolean} [incluirInactivos=false]
 * @returns {Promise<{ data: Array<Record<string, unknown>> | null, error: string | null }>}
 */
export async function listarProductos(incluirInactivos = false) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_producto_listar", {
    p_incluir_inactivos: Boolean(incluirInactivos),
    p_id_marca: null,
    p_id_categoria: null,
    p_id_rubro: null,
    p_busqueda: null,
  });

  if (error) {
    return { data: null, error: "No se pudieron cargar los productos." };
  }

  return { data: data ?? [], error: null };
}

/**
 * Chequeo en vivo del código, para feedback en el form. La validación real la
 * hace igual el RPC de crear/modificar (`PRD03`).
 *
 * @param {string} codigo
 * @param {string | null} [idProducto]
 * @returns {Promise<{ disponible: boolean, error: string | null }>}
 */
export async function validarCodigoUnicoProducto(codigo, idProducto = null) {
  const limpio = String(codigo ?? "").trim();
  if (limpio === "") {
    return { disponible: false, error: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_producto_validar_codigo_unico", {
    p_codigo_producto: limpio,
    p_id_producto: idProducto || null,
  });

  if (error) {
    return { disponible: true, error: "No se pudo validar el código." };
  }

  return { disponible: data === true, error: null };
}

/**
 * @param {FormData} formData
 * @returns {Promise<{ ok: boolean, error: string | null, code?: string | null }>}
 */
export async function crearProducto(formData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      code: null,
      error: "Debés iniciar sesión para crear un producto.",
    };
  }

  const { error } = await supabase.rpc("fn_producto_crear", {
    p_id_marca: texto(formData, "id_marca") || null,
    p_nombre_producto: texto(formData, "nombre_producto"),
    p_descripcion_producto: texto(formData, "descripcion_producto"),
    p_codigo_producto: texto(formData, "codigo_producto"),
    p_id_unidad_medida: texto(formData, "id_unidad_medida") || null,
    p_numero_medida: numero(formData, "numero_medida"),
    p_creado_por: user.id,
    p_id_categoria: texto(formData, "id_categoria") || null,
    p_precio_producto: 0,
    p_costo_producto: numero(formData, "costo_producto") ?? 0,
    p_precio_mayorista_producto: numero(formData, "precio_mayorista_producto") ?? 0,
    p_precio_minorista_producto: numero(formData, "precio_minorista_producto") ?? 0,
  });

  if (error) {
    return errorResult(error, "No se pudo crear el producto.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

/**
 * @param {string} id_producto
 * @param {FormData} formData
 * @returns {Promise<{ ok: boolean, error: string | null, code?: string | null }>}
 */
export async function actualizarProducto(id_producto, formData) {
  if (!id_producto) {
    return { ok: false, code: null, error: "Falta el identificador del producto." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_producto_modificar", {
    p_id_producto: id_producto,
    p_id_marca: texto(formData, "id_marca") || null,
    p_nombre_producto: texto(formData, "nombre_producto"),
    p_descripcion_producto: texto(formData, "descripcion_producto"),
    p_codigo_producto: texto(formData, "codigo_producto"),
    p_id_unidad_medida: texto(formData, "id_unidad_medida") || null,
    p_numero_medida: numero(formData, "numero_medida"),
    p_id_categoria: texto(formData, "id_categoria") || null,
    p_precio_producto: 0,
    p_costo_producto: numero(formData, "costo_producto") ?? 0,
    p_precio_mayorista_producto: numero(formData, "precio_mayorista_producto") ?? 0,
    p_precio_minorista_producto: numero(formData, "precio_minorista_producto") ?? 0,
  });

  if (error) {
    return errorResult(error, "No se pudo guardar el producto.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

/**
 * @param {string} id_producto
 */
export async function habilitarProducto(id_producto) {
  if (!id_producto) {
    return { ok: false, code: null, error: "Falta el identificador del producto." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_producto_habilitar", {
    p_id_producto: id_producto,
  });

  if (error) {
    return errorResult(error, "No se pudo habilitar el producto.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

/**
 * @param {string} id_producto
 */
export async function inhabilitarProducto(id_producto) {
  if (!id_producto) {
    return { ok: false, code: null, error: "Falta el identificador del producto." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_producto_inhabilitar", {
    p_id_producto: id_producto,
  });

  if (error) {
    return errorResult(error, "No se pudo inhabilitar el producto.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

/**
 * @param {string} id_producto
 */
export async function eliminarProducto(id_producto) {
  if (!id_producto) {
    return { ok: false, code: null, error: "Falta el identificador del producto." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_producto_eliminar", {
    p_id_producto: id_producto,
  });

  if (error) {
    // PRD09: tiene compras / movimientos asociados; el mensaje trae la cantidad.
    return errorResult(error, "No se pudo eliminar el producto.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}
