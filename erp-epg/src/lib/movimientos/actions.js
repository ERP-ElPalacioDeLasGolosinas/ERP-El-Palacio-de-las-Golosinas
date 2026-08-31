"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const PATH = "/inventario/movimientos";

/**
 * Propaga el `code` (ERRCODE custom MOV01..MOV07) y el `message` del RPC (ya en
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
 * Lista movimientos de stock vía RPC `fn_movimiento_stock_listar`. Cada fila
 * viene enriquecida (JOINs a tipo_movimiento, producto→marca/unidad, deposito,
 * vw_usuario_resumen), con `valor` = `signo * cantidad` ya firmado y los datos
 * de referencia de corrección (`id_movimiento_referencia`, `referencia_*`).
 *
 * @param {{
 *   id_producto?: string | null,
 *   id_deposito?: string | null,
 *   id_tipo_movimiento?: string | null,
 *   fecha_desde?: string | null,
 *   fecha_hasta?: string | null,
 * }} [filtros]
 * @returns {Promise<{ data: Array<Record<string, unknown>> | null, error: string | null }>}
 */
export async function listarMovimientos(filtros = {}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_movimiento_stock_listar", {
    p_id_producto: filtros.id_producto || null,
    p_id_deposito: filtros.id_deposito || null,
    p_id_tipo_movimiento: filtros.id_tipo_movimiento || null,
    p_fecha_desde: filtros.fecha_desde || null,
    p_fecha_hasta: filtros.fecha_hasta || null,
  });

  if (error) {
    return { data: null, error: "No se pudieron cargar los movimientos." };
  }

  return { data: data ?? [], error: null };
}

/**
 * Consulta el stock disponible de un producto en un depósito, para validar en
 * vivo un egreso antes de confirmarlo (evita el round-trip de `MOV05`).
 *
 * @param {string} idProducto
 * @param {string} idDeposito
 * @param {number} cantidad
 * @returns {Promise<{ stockActual: number | null, alcanza: boolean, error: string | null }>}
 */
export async function validarStockDisponible(idProducto, idDeposito, cantidad) {
  if (!idProducto || !idDeposito) {
    return { stockActual: null, alcanza: false, error: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "fn_movimiento_stock_validar_stock_disponible",
    {
      p_id_producto: idProducto,
      p_id_deposito: idDeposito,
      p_cantidad: Number(cantidad) || 0,
    }
  );

  if (error) {
    return { stockActual: null, alcanza: false, error: "No se pudo validar el stock." };
  }

  const fila = Array.isArray(data) ? data[0] : data;
  return {
    stockActual: fila?.stock_actual ?? 0,
    alcanza: fila?.alcanza === true,
    error: null,
  };
}

/**
 * Registra un movimiento de stock vía RPC `fn_movimiento_stock_registrar`.
 * El RPC controla stock, descuenta lotes FIFO por vencimiento, actualiza
 * `stock` y escribe `movimiento_stock_detalle`. Si `id_movimiento_referencia`
 * viene seteado, el movimiento queda ligado al original (corrección).
 *
 * @param {FormData} formData
 * @returns {Promise<{ ok: boolean, error: string | null, code?: string | null }>}
 */
export async function registrarMovimiento(formData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      code: null,
      error: "Debés iniciar sesión para registrar un movimiento.",
    };
  }

  const cantidadRaw = texto(formData, "cantidad");
  const cantidad = Number(cantidadRaw);

  const { error } = await supabase.rpc("fn_movimiento_stock_registrar", {
    p_id_tipo_movimiento: texto(formData, "id_tipo_movimiento") || null,
    p_id_producto: texto(formData, "id_producto") || null,
    p_id_deposito: texto(formData, "id_deposito") || null,
    p_cantidad: Number.isFinite(cantidad) ? cantidad : null,
    p_creado_por: user.id,
    p_fecha_movimiento: texto(formData, "fecha_movimiento") || null,
    p_remito: texto(formData, "remito") || null,
    p_id_movimiento_referencia:
      texto(formData, "id_movimiento_referencia") || null,
  });

  if (error) {
    return errorResult(error, "No se pudo registrar el movimiento.");
  }

  revalidatePath(PATH);
  revalidatePath("/inventario/stock");
  return { ok: true, error: null, code: null };
}

/**
 * Lista los productos con stock disponible (> 0) en un depósito, vía RPC
 * `fn_producto_listar_por_deposito`. Usada para poblar el combo de Producto
 * del wizard una vez elegido el Depósito (origen).
 *
 * @param {string} idDeposito
 * @param {boolean} [incluirInactivos=false]
 * @returns {Promise<{ data: Array<Record<string, unknown>> | null, error: string | null }>}
 */
export async function listarProductosPorDeposito(
  idDeposito,
  incluirInactivos = false
) {
  if (!idDeposito) {
    return { data: [], error: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_producto_listar_por_deposito", {
    p_id_deposito: idDeposito,
    p_incluir_inactivos: Boolean(incluirInactivos),
  });

  if (error) {
    return { data: null, error: "No se pudieron cargar los productos del depósito." };
  }

  return { data: data ?? [], error: null };
}

/**
 * Lista los productos que tuvieron movimientos históricos en un depósito, vía
 * RPC `fn_producto_listar_por_deposito_movimientos`. A diferencia de
 * `listarProductosPorDeposito` (que mira `stock.cantidad > 0`), ésta se basa en
 * `movimiento_stock`, así que incluye productos que hoy están en 0 pero que
 * tuvieron movimientos en ese depósito. Usada para poblar el combo de Producto
 * del filtro del listado de movimientos una vez elegido el Depósito.
 *
 * @param {string} idDeposito
 * @param {boolean} [incluirInactivos=true]
 * @returns {Promise<{ data: Array<{
 *   id_producto: string,
 *   nombre_completo: string,
 * }> | null, error: string | null }>}
 */
export async function listarProductosPorDepositoMovimientos(
  idDeposito,
  incluirInactivos = true
) {
  if (!idDeposito) {
    return { data: [], error: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "fn_producto_listar_por_deposito_movimientos",
    {
      p_id_deposito: idDeposito,
      p_incluir_inactivos: Boolean(incluirInactivos),
    }
  );

  if (error) {
    return {
      data: null,
      error: "No se pudieron cargar los productos del depósito.",
    };
  }

  return { data: data ?? [], error: null };
}

/**
 * Registra una transferencia de mercadería entre dos depósitos vía RPC
 * `fn_movimiento_stock_transferir` (uso puntual, sin pasar por el lote).
 * Internamente registra una salida en el origen y una entrada en el destino,
 * referenciadas entre sí, en una única transacción.
 *
 * @param {{
 *   idProducto: string,
 *   idDepositoOrigen: string,
 *   idDepositoDestino: string,
 *   cantidad: number,
 *   fechaMovimiento?: string | null,
 *   remito?: string | null,
 * }} input
 * @returns {Promise<{ ok: boolean, error: string | null, code?: string | null }>}
 */
export async function registrarTransferencia({
  idProducto,
  idDepositoOrigen,
  idDepositoDestino,
  cantidad,
  fechaMovimiento,
  remito,
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      code: null,
      error: "Debés iniciar sesión para registrar una transferencia.",
    };
  }

  const { error } = await supabase.rpc("fn_movimiento_stock_transferir", {
    p_id_producto: idProducto || null,
    p_id_deposito_origen: idDepositoOrigen || null,
    p_id_deposito_destino: idDepositoDestino || null,
    p_cantidad: Number(cantidad) || null,
    p_creado_por: user.id,
    p_fecha_movimiento: fechaMovimiento || null,
    p_remito: remito || null,
  });

  if (error) {
    return errorResult(error, "No se pudo registrar la transferencia.");
  }

  revalidatePath(PATH);
  revalidatePath("/inventario/stock");
  return { ok: true, error: null, code: null };
}

/**
 * Registra un lote de movimientos (simples y/o transferencias) en una única
 * transacción atómica vía RPC `fn_movimiento_stock_registrar_lote`. Si
 * cualquier ítem falla, no queda nada registrado.
 *
 * @param {Array<Record<string, unknown>>} items
 * @returns {Promise<{ ok: boolean, error: string | null, code?: string | null, data?: unknown }>}
 */
export async function registrarMovimientosLote(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      ok: false,
      code: "MLT01",
      error: "Debés cargar al menos un movimiento antes de registrar.",
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
      error: "Debés iniciar sesión para registrar movimientos.",
    };
  }

  const { data, error } = await supabase.rpc("fn_movimiento_stock_registrar_lote", {
    p_movimientos: items,
    p_creado_por: user.id,
  });

  if (error) {
    return errorResult(error, "No se pudieron registrar los movimientos.");
  }

  revalidatePath(PATH);
  revalidatePath("/inventario/stock");
  return { ok: true, error: null, code: null, data };
}
