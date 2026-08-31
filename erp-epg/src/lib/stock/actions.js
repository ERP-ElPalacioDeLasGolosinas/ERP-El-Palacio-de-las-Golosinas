"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Consulta el stock por producto y depósito vía RPC `fn_stock_consultar`.
 * Los filtros son opcionales; sin filtros devuelve todo el stock (> 0).
 *
 * Nota: el listado principal de `inventario/stock` pasó a `consultarStockResumen`
 * (una fila por producto). Esta función se mantiene como fallback / uso puntual
 * producto × depósito.
 *
 * @param {{ id_producto?: string | null, id_deposito?: string | null }} [filtros]
 * @returns {Promise<{ data: Array<{
 *   id_stock: string,
 *   id_producto: string,
 *   codigo_producto: string,
 *   producto: string,
 *   id_unidad_medida: string,
 *   unidad_medida: string,
 *   id_deposito: string,
 *   nombre_deposito: string,
 *   cantidad: number,
 *   editado: string,
 * }> | null, error: string | null }>}
 */
export async function consultarStock(filtros = {}) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("fn_stock_consultar", {
    p_id_producto: filtros.id_producto ?? null,
    p_id_deposito: filtros.id_deposito ?? null,
  });

  if (error) {
    return { data: null, error: "No se pudo consultar el stock." };
  }

  // Orden estable para la tabla: por producto y luego por depósito.
  const rows = (data ?? [])
    .slice()
    .sort(
      (a, b) =>
        a.producto.localeCompare(b.producto, "es") ||
        a.nombre_deposito.localeCompare(b.nombre_deposito, "es")
    );

  return { data: rows, error: null };
}

/**
 * Listado principal de stock: una fila por producto, con el total sumado entre
 * todos los depósitos donde tiene stock. RPC `fn_stock_resumen_por_producto`.
 *
 * @param {string | null} [busqueda] Texto libre (código / nombre / marca).
 * @param {boolean} [incluirInactivos=false]
 * @returns {Promise<{ data: Array<{
 *   id_producto: string,
 *   codigo_producto: string,
 *   nombre_producto: string,
 *   nombre_completo: string,
 *   nombre_marca: string,
 *   stock_total: number,
 *   cantidad_depositos: number,
 * }> | null, error: string | null }>}
 */
export async function consultarStockResumen(
  busqueda = null,
  incluirInactivos = false
) {
  const supabase = await createClient();

  const limpio = String(busqueda ?? "").trim();
  const { data, error } = await supabase.rpc("fn_stock_resumen_por_producto", {
    p_busqueda: limpio || null,
    p_incluir_inactivos: Boolean(incluirInactivos),
  });

  if (error) {
    return { data: null, error: "No se pudo consultar el stock." };
  }

  return { data: data ?? [], error: null };
}

/**
 * Trae la descripción completa de un producto puntual, reutilizando
 * `fn_producto_listar` con su parámetro opcional `p_id_producto`. Devuelve la
 * primera (y única) fila, o `null` si no existe.
 *
 * @param {string} idProducto
 * @returns {Promise<{ data: Record<string, unknown> | null, error: string | null }>}
 */
export async function obtenerProductoDetalle(idProducto) {
  if (!idProducto) {
    return { data: null, error: "Falta el identificador del producto." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_producto_listar", {
    p_incluir_inactivos: true,
    p_id_marca: null,
    p_id_categoria: null,
    p_id_rubro: null,
    p_busqueda: null,
    p_id_producto: idProducto,
  });

  if (error) {
    return { data: null, error: "No se pudo cargar el producto." };
  }

  const fila = Array.isArray(data) ? data[0] : data;
  return { data: fila ?? null, error: null };
}

/**
 * Desglose del stock de un producto por cada depósito donde está presente.
 * RPC `fn_stock_por_producto_por_deposito`.
 *
 * @param {string} idProducto
 * @returns {Promise<{ data: Array<{
 *   id_deposito: string,
 *   nombre_deposito: string,
 *   cantidad: number,
 * }> | null, error: string | null }>}
 */
export async function obtenerStockPorDeposito(idProducto) {
  if (!idProducto) {
    return { data: [], error: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "fn_stock_por_producto_por_deposito",
    { p_id_producto: idProducto }
  );

  if (error) {
    return { data: null, error: "No se pudo cargar el stock por depósito." };
  }

  return { data: data ?? [], error: null };
}

/**
 * Últimos lotes (`inventario_producto`) de un producto en cualquier depósito,
 * ordenados por vencimiento más próximo primero. RPC
 * `fn_inventario_producto_listar_por_producto` (`SECURITY DEFINER`).
 *
 * @param {string} idProducto
 * @param {number} [limite=50]
 * @returns {Promise<{ data: Array<{
 *   id_inventario_producto: string,
 *   id_lote: string,
 *   id_deposito: string,
 *   nombre_deposito: string,
 *   codigo_producto: string,
 *   nombre_completo: string,
 *   fecha_vencimiento: string | null,
 *   fecha_fabricacion: string | null,
 *   cantidad_inventario: number,
 *   stock_disponible: number,
 *   stock: string,
 *   observaciones: string | null,
 * }> | null, error: string | null }>}
 */
export async function obtenerUltimosLotes(idProducto, limite = 50) {
  if (!idProducto) {
    return { data: [], error: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "fn_inventario_producto_listar_por_producto",
    { p_id_producto: idProducto, p_limite: limite }
  );

  if (error) {
    return { data: null, error: "No se pudieron cargar los lotes del producto." };
  }

  return { data: data ?? [], error: null };
}

/**
 * Listado mínimo de proveedores (id + nombre) para poblar el select del alta de
 * lote. RPC `fn_proveedor_listar_min` (`SECURITY DEFINER`: `proveedor` tiene RLS
 * sin políticas, la función expone solo id + nombre).
 *
 * @returns {Promise<{ data: Array<{
 *   id_proveedor: string,
 *   nombre_proveedor: string,
 * }> | null, error: string | null }>}
 */
export async function listarProveedoresMin() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_proveedor_listar_min");

  if (error) {
    return { data: null, error: "No se pudieron cargar los proveedores." };
  }

  return { data: data ?? [], error: null };
}

/**
 * Historial de los últimos lotes ingresados (cualquier producto), ordenado por
 * fecha de registro más reciente primero. RPC
 * `fn_inventario_producto_listar_recientes` (`SECURITY DEFINER`).
 *
 * @param {string | null} [idDeposito] Filtro opcional por depósito.
 * @param {number} [limite=50]
 * @returns {Promise<{ data: Array<{
 *   id_inventario_producto: string,
 *   id_lote: string,
 *   id_producto: string,
 *   codigo_producto: string,
 *   nombre_completo: string,
 *   id_deposito: string,
 *   nombre_deposito: string,
 *   fecha_registro: string,
 *   fecha_fabricacion: string | null,
 *   fecha_vencimiento: string | null,
 *   cantidad_inventario: number,
 *   stock_disponible: number,
 *   stock: string,
 * }> | null, error: string | null }>}
 */
export async function listarLotesRecientes(idDeposito = null, limite = 50) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "fn_inventario_producto_listar_recientes",
    { p_id_deposito: idDeposito || null, p_limite: limite }
  );

  if (error) {
    return { data: null, error: "No se pudieron cargar los lotes." };
  }

  return { data: data ?? [], error: null };
}

/**
 * Registra un lote completo (datos generales + N productos) en una sola
 * operación atómica vía RPC `fn_lote_registrar_completo`. Internamente crea la
 * compra de soporte, el `inventario` / `inventario_producto` y el movimiento de
 * ingreso por producto para que `stock` quede reflejado.
 *
 * @param {{
 *   idDeposito: string,
 *   idProveedor: string,
 *   detalleLote?: string | null,
 *   productos: Array<{
 *     id_producto: string,
 *     cantidad: number,
 *     fecha_elaboracion?: string | null,
 *     fecha_vencimiento?: string | null,
 *     observaciones?: string | null,
 *   }>,
 * }} input
 * @returns {Promise<{ ok: boolean, error: string | null, code?: string | null, data?: unknown }>}
 */
export async function registrarLote({
  idDeposito,
  idProveedor,
  detalleLote,
  productos,
}) {
  if (!Array.isArray(productos) || productos.length === 0) {
    return {
      ok: false,
      code: "LOT01",
      error: "Cargá al menos un producto antes de registrar el lote.",
    };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      code: null,
      error: "Debés iniciar sesión para registrar un lote.",
    };
  }

  const items = productos.map((p) => ({
    id_producto: p.id_producto,
    cantidad: Number(p.cantidad) || 0,
    fecha_elaboracion: p.fecha_elaboracion ?? null,
    fecha_vencimiento: p.fecha_vencimiento ?? null,
    observaciones: p.observaciones?.trim() ? p.observaciones.trim() : null,
  }));

  const { data, error } = await supabase.rpc("fn_lote_registrar_completo", {
    p_id_deposito: idDeposito || null,
    p_id_proveedor: idProveedor || null,
    p_detalle_lote: detalleLote?.trim() ? detalleLote.trim() : null,
    p_creado_por: user.id,
    p_productos: items,
  });

  if (error) {
    return {
      ok: false,
      code: error.code ?? null,
      error: error.message || "No se pudo registrar el lote.",
    };
  }

  revalidatePath("/inventario/stock");
  revalidatePath("/inventario/stock/lotes");
  return { ok: true, error: null, code: null, data };
}
