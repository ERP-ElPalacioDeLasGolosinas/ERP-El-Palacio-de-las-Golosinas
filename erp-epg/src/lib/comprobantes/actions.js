"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const PATH = "/compras/comprobantes";

/**
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

/** @param {unknown} valor @returns {number | null} */
function numero(valor) {
  if (valor == null || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

/** @param {unknown} valor @returns {string | null} */
function textoOpcional(valor) {
  if (valor == null) return null;
  const s = String(valor).trim();
  return s.length > 0 ? s : null;
}

/**
 * Lista comprobantes de proveedor vía `fn_comprobante_listar`.
 *
 * @param {{ idProveedor?: string | null, soloPendientes?: boolean, desde?: string | null, hasta?: string | null }} [filtros]
 * @returns {Promise<{ data: Array<Record<string, unknown>> | null, error: string | null }>}
 */
export async function listarComprobantes(filtros = {}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_comprobante_listar", {
    p_id_proveedor: filtros.idProveedor || null,
    p_solo_pendientes: Boolean(filtros.soloPendientes),
    p_desde: filtros.desde || null,
    p_hasta: filtros.hasta || null,
  });

  if (error) {
    return { data: null, error: "No se pudieron cargar los comprobantes." };
  }

  return { data: data ?? [], error: null };
}

/**
 * Cabecera enriquecida de un comprobante vía `fn_comprobante_obtener`
 * (proveedor, tipo, signo, número formateado, saldo, `creado_por_nombre`,
 * `total_detalle` y `diferencia` frente al importe total).
 *
 * @param {string} id_comprobante
 * @returns {Promise<{ data: Record<string, unknown> | null, error: string | null }>}
 */
export async function obtenerComprobante(id_comprobante) {
  if (!id_comprobante) {
    return { data: null, error: "Falta el identificador del comprobante." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_comprobante_obtener", {
    p_id_comprobante: id_comprobante,
  });

  if (error) {
    return { data: null, error: "No se pudo cargar el comprobante." };
  }

  const fila = Array.isArray(data) ? data[0] : data;
  return { data: fila ?? null, error: null };
}

/**
 * Líneas de un comprobante vía `fn_comprobante_detalle_listar`.
 *
 * @param {string} id_comprobante
 * @returns {Promise<{ data: Array<Record<string, unknown>> | null, error: string | null }>}
 */
export async function listarDetalleComprobante(id_comprobante) {
  if (!id_comprobante) {
    return { data: null, error: "Falta el identificador del comprobante." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_comprobante_detalle_listar", {
    p_id_comprobante: id_comprobante,
  });

  if (error) {
    return { data: null, error: "No se pudo cargar el detalle del comprobante." };
  }

  return { data: data ?? [], error: null };
}

/**
 * Compara la suma del detalle con el importe total vía
 * `fn_comprobante_detalle_validar`. La usa el formulario de alta antes de
 * confirmar, para advertir la diferencia (C-11).
 *
 * @param {{ detalle: Array<{ cantidad: number | string, precio_unitario: number | string }>, importe_total: number | string }} entrada
 * @returns {Promise<{ data: { total_detalle: number, diferencia: number, coincide: boolean } | null, error: string | null }>}
 */
export async function validarDetalle(entrada) {
  const detalle = Array.isArray(entrada?.detalle) ? entrada.detalle : [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_comprobante_detalle_validar", {
    p_detalle: detalle.map((linea) => ({
      cantidad: numero(linea.cantidad),
      precio_unitario: numero(linea.precio_unitario),
    })),
    p_importe_total: numero(entrada?.importe_total),
  });

  if (error) {
    return { data: null, error: "No se pudo validar el detalle." };
  }

  const fila = Array.isArray(data) ? data[0] : data;
  if (!fila) {
    return { data: null, error: "No se pudo validar el detalle." };
  }

  return {
    data: {
      total_detalle: Number(fila.total_detalle) || 0,
      diferencia: Number(fila.diferencia) || 0,
      coincide: Boolean(fila.coincide),
    },
    error: null,
  };
}

/**
 * Alta transaccional de un comprobante con su detalle (D-011).
 *
 * @param {{
 *   id_proveedor: string,
 *   id_tipo_comprobante: string,
 *   punto_venta: number | string,
 *   numero: number | string,
 *   fecha_comprobante: string,
 *   fecha_vencimiento?: string | null,
 *   importe_total: number | string,
 *   id_compra?: string | null,
 *   observaciones?: string | null,
 *   confirmar_diferencia?: boolean,
 *   detalle: Array<{
 *     id_producto?: string | null,
 *     concepto?: string | null,
 *     cantidad: number | string,
 *     precio_unitario: number | string,
 *   }>,
 * }} entrada
 * @returns {Promise<{ ok: boolean, error: string | null, code?: string | null }>}
 */
export async function registrarComprobante(entrada) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      code: null,
      error: "Debés iniciar sesión para registrar un comprobante.",
    };
  }

  const detalle = Array.isArray(entrada.detalle) ? entrada.detalle : [];

  const { error } = await supabase.rpc("fn_comprobante_registrar", {
    p_id_proveedor: entrada.id_proveedor || null,
    p_id_tipo_comprobante: entrada.id_tipo_comprobante || null,
    p_punto_venta: numero(entrada.punto_venta),
    p_numero: numero(entrada.numero),
    p_fecha_comprobante: entrada.fecha_comprobante || null,
    p_fecha_vencimiento: entrada.fecha_vencimiento || null,
    p_importe_total: numero(entrada.importe_total),
    p_id_compra: entrada.id_compra || null,
    p_observaciones: textoOpcional(entrada.observaciones),
    p_detalle: detalle.map((linea) => ({
      id_producto: linea.id_producto || null,
      concepto: textoOpcional(linea.concepto),
      cantidad: numero(linea.cantidad),
      precio_unitario: numero(linea.precio_unitario),
    })),
    p_confirmar_diferencia: Boolean(entrada.confirmar_diferencia),
    p_creado_por: user.id,
  });

  if (error) {
    return errorResult(error, "No se pudo registrar el comprobante.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

/**
 * Anula (baja lógica) un comprobante.
 *
 * @param {string} id_comprobante
 * @returns {Promise<{ ok: boolean, error: string | null, code?: string | null }>}
 */
export async function anularComprobante(id_comprobante) {
  if (!id_comprobante) {
    return {
      ok: false,
      code: null,
      error: "Falta el identificador del comprobante.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_comprobante_anular", {
    p_id_comprobante: id_comprobante,
  });

  if (error) {
    return errorResult(error, "No se pudo anular el comprobante.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}
