"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ESTADOS_ORDEN_PAGO } from "@/lib/ordenes-pago/constantes";

const PATH = "/tesoreria/ordenes-de-pago";

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
 * Normaliza las imputaciones que manda el formulario a la forma que espera
 * `fn_orden_pago_*` (`{ id_comprobante, importe_imputado }`).
 *
 * @param {Array<{ id_comprobante?: string, importe_imputado?: number | string }>} imputaciones
 */
function mapImputaciones(imputaciones) {
  return (Array.isArray(imputaciones) ? imputaciones : []).map((i) => ({
    id_comprobante: i.id_comprobante || null,
    importe_imputado: numero(i.importe_imputado),
  }));
}

/**
 * Normaliza las líneas de medios que manda el formulario
 * (`{ id_medio_pago, id_cuenta_tesoreria, importe, referencia }`).
 *
 * @param {Array<{ id_medio_pago?: string, id_cuenta_tesoreria?: string, importe?: number | string, referencia?: string | null }>} medios
 */
function mapMedios(medios) {
  return (Array.isArray(medios) ? medios : []).map((m) => ({
    id_medio_pago: m.id_medio_pago || null,
    id_cuenta_tesoreria: m.id_cuenta_tesoreria || null,
    importe: numero(m.importe),
    referencia: textoOpcional(m.referencia),
  }));
}

/**
 * Lista órdenes de pago vía `fn_orden_pago_listar` (incluye
 * `nombre_proveedor`, `cantidad_comprobantes` y `creado_por_nombre`).
 *
 * @param {{ idProveedor?: string | null, estado?: string | null, desde?: string | null, hasta?: string | null }} [filtros]
 * @returns {Promise<{ data: Array<Record<string, unknown>> | null, error: string | null }>}
 */
export async function listarOrdenesPago(filtros = {}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_orden_pago_listar", {
    p_id_proveedor: filtros.idProveedor || null,
    p_estado: ESTADOS_ORDEN_PAGO.includes(filtros.estado) ? filtros.estado : null,
    p_desde: filtros.desde || null,
    p_hasta: filtros.hasta || null,
  });

  if (error) {
    return { data: null, error: "No se pudieron cargar las órdenes de pago." };
  }

  return { data: data ?? [], error: null };
}

/**
 * Orden de pago completa (cabecera + imputaciones + medios) vía
 * `fn_orden_pago_obtener`, que devuelve un objeto jsonb.
 *
 * @param {string} idOrdenPago
 * @returns {Promise<{ data: { orden: Record<string, unknown>, comprobantes: Array<Record<string, unknown>>, medios: Array<Record<string, unknown>> } | null, error: string | null }>}
 */
export async function obtenerOrdenPago(idOrdenPago) {
  if (!idOrdenPago) {
    return { data: null, error: "Falta el identificador de la orden de pago." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_orden_pago_obtener", {
    p_id_orden_pago: idOrdenPago,
  });

  if (error) {
    return { data: null, error: "No se pudo cargar la orden de pago." };
  }

  return { data: data ?? null, error: null };
}

/**
 * Alta transaccional de una orden de pago (D-014).
 *
 * @param {{
 *   id_proveedor: string,
 *   fecha_prevista?: string | null,
 *   referencia?: string | null,
 *   observaciones?: string | null,
 *   confirmar?: boolean,
 *   imputaciones: Array<{ id_comprobante: string, importe_imputado: number | string }>,
 *   medios: Array<{ id_medio_pago: string, id_cuenta_tesoreria: string, importe: number | string, referencia?: string | null }>,
 * }} entrada
 * @returns {Promise<{ ok: boolean, id?: string | null, error: string | null, code?: string | null }>}
 */
export async function crearOrdenPago(entrada) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      code: null,
      error: "Debés iniciar sesión para registrar una orden de pago.",
    };
  }

  const { data, error } = await supabase.rpc("fn_orden_pago_crear", {
    p_id_proveedor: entrada.id_proveedor || null,
    p_fecha_prevista: entrada.fecha_prevista || null,
    p_referencia: textoOpcional(entrada.referencia),
    p_observaciones: textoOpcional(entrada.observaciones),
    p_imputaciones: mapImputaciones(entrada.imputaciones),
    p_medios: mapMedios(entrada.medios),
    p_confirmar: Boolean(entrada.confirmar),
    p_creado_por: user.id,
  });

  if (error) {
    return errorResult(error, "No se pudo registrar la orden de pago.");
  }

  revalidatePath(PATH);
  return { ok: true, id: data?.id_orden_pago ?? null, error: null, code: null };
}

/**
 * Edita una orden de pago en estado Borrador.
 *
 * @param {string} idOrdenPago
 * @param {{
 *   fecha_prevista?: string | null,
 *   referencia?: string | null,
 *   observaciones?: string | null,
 *   imputaciones: Array<{ id_comprobante: string, importe_imputado: number | string }>,
 *   medios: Array<{ id_medio_pago: string, id_cuenta_tesoreria: string, importe: number | string, referencia?: string | null }>,
 * }} entrada
 * @returns {Promise<{ ok: boolean, error: string | null, code?: string | null }>}
 */
export async function editarOrdenPago(idOrdenPago, entrada) {
  if (!idOrdenPago) {
    return { ok: false, code: null, error: "Falta el identificador de la orden de pago." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_orden_pago_editar", {
    p_id_orden_pago: idOrdenPago,
    p_fecha_prevista: entrada.fecha_prevista || null,
    p_referencia: textoOpcional(entrada.referencia),
    p_observaciones: textoOpcional(entrada.observaciones),
    p_imputaciones: mapImputaciones(entrada.imputaciones),
    p_medios: mapMedios(entrada.medios),
  });

  if (error) {
    return errorResult(error, "No se pudo guardar la orden de pago.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

/**
 * Confirma una orden de pago (Borrador → Pendiente de pago).
 *
 * @param {string} idOrdenPago
 * @returns {Promise<{ ok: boolean, error: string | null, code?: string | null }>}
 */
export async function confirmarOrdenPago(idOrdenPago) {
  if (!idOrdenPago) {
    return { ok: false, code: null, error: "Falta el identificador de la orden de pago." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_orden_pago_confirmar", {
    p_id_orden_pago: idOrdenPago,
  });

  if (error) {
    return errorResult(error, "No se pudo confirmar la orden de pago.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

/**
 * Cancela una orden de pago y revierte el estado de sus comprobantes.
 *
 * @param {string} idOrdenPago
 * @returns {Promise<{ ok: boolean, error: string | null, code?: string | null }>}
 */
export async function cancelarOrdenPago(idOrdenPago) {
  if (!idOrdenPago) {
    return { ok: false, code: null, error: "Falta el identificador de la orden de pago." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_orden_pago_cancelar", {
    p_id_orden_pago: idOrdenPago,
  });

  if (error) {
    return errorResult(error, "No se pudo cancelar la orden de pago.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}
