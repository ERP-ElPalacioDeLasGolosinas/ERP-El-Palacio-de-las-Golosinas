"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const PATH = "/tesoreria/pagos";

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
 * Normaliza las aplicaciones del formulario a `{ id_comprobante, importe_aplicado }`.
 *
 * @param {Array<{ id_comprobante?: string, importe_aplicado?: number | string }>} aplicaciones
 */
function mapAplicaciones(aplicaciones) {
  return (Array.isArray(aplicaciones) ? aplicaciones : []).map((a) => ({
    id_comprobante: a.id_comprobante || null,
    importe_aplicado: numero(a.importe_aplicado),
  }));
}

/**
 * Normaliza las líneas de medios del formulario
 * (`{ id_medio_pago, id_cuenta_tesoreria, importe, referencia }`).
 *
 * @param {Array<{ id_medio_pago?: string, id_cuenta_tesoreria?: string, importe?: number | string, referencia?: string | null, cheque?: Record<string, unknown> | null }>} medios
 */
function mapMedios(medios) {
  return (Array.isArray(medios) ? medios : []).map((m) => {
    const entrada = {
      id_medio_pago: m.id_medio_pago || null,
      id_cuenta_tesoreria: m.id_cuenta_tesoreria || null,
      importe: numero(m.importe),
      referencia: textoOpcional(m.referencia),
    };
    if (m.cheque) {
      entrada.cheque = {
        numero: textoOpcional(m.cheque.numero),
        banco: textoOpcional(m.cheque.banco),
        cuenta: textoOpcional(m.cheque.cuenta),
        fecha_emision: textoOpcional(m.cheque.fecha_emision),
        fecha_pago: textoOpcional(m.cheque.fecha_pago),
        importe: numero(m.cheque.importe),
      };
    }
    return entrada;
  });
}

/**
 * Lista pagos vía `fn_pago_listar` (incluye `nombre_proveedor`,
 * `cantidad_comprobantes` y `creado_por_nombre`).
 *
 * @param {{ idProveedor?: string | null, desde?: string | null, hasta?: string | null }} [filtros]
 * @returns {Promise<{ data: Array<Record<string, unknown>> | null, error: string | null }>}
 */
export async function listarPagos(filtros = {}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_pago_listar", {
    p_id_proveedor: filtros.idProveedor || null,
    p_desde: filtros.desde || null,
    p_hasta: filtros.hasta || null,
  });

  if (error) {
    return { data: null, error: "No se pudieron cargar los pagos." };
  }

  return { data: data ?? [], error: null };
}

/**
 * Pago completo (cabecera + medios + aplicaciones + movimientos) vía
 * `fn_pago_obtener`, que devuelve un objeto jsonb.
 *
 * @param {string} idPago
 * @returns {Promise<{ data: { pago: Record<string, unknown>, medios: Array<Record<string, unknown>>, aplicaciones: Array<Record<string, unknown>>, movimientos: Array<Record<string, unknown>> } | null, error: string | null }>}
 */
export async function obtenerPago(idPago) {
  if (!idPago) {
    return { data: null, error: "Falta el identificador del pago." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_pago_obtener", {
    p_id_pago: idPago,
  });

  if (error) {
    return { data: null, error: "No se pudo cargar el pago." };
  }

  return { data: data ?? null, error: null };
}

/**
 * Registra un pago desde una orden de pago (T-08, criterio de aceptación
 * central del sprint): genera el pago, los movimientos de tesorería, aplica
 * el importe a los comprobantes y recalcula los estados.
 *
 * @param {{
 *   id_orden_pago: string,
 *   fecha_pago?: string | null,
 *   confirmar_diferencia?: boolean,
 *   medios: Array<{ id_medio_pago: string, id_cuenta_tesoreria: string, importe: number | string, referencia?: string | null }>,
 *   aplicaciones: Array<{ id_comprobante: string, importe_aplicado: number | string }>,
 * }} entrada
 * @returns {Promise<{ ok: boolean, id?: string | null, error: string | null, code?: string | null }>}
 */
export async function registrarPago(entrada) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      code: null,
      error: "Debés iniciar sesión para registrar un pago.",
    };
  }

  const { data, error } = await supabase.rpc("fn_pago_registrar", {
    p_id_orden_pago: entrada.id_orden_pago || null,
    p_fecha_pago: entrada.fecha_pago || null,
    p_medios: mapMedios(entrada.medios),
    p_aplicaciones: mapAplicaciones(entrada.aplicaciones),
    p_confirmar_diferencia: Boolean(entrada.confirmar_diferencia),
    p_creado_por: user.id,
  });

  if (error) {
    return errorResult(error, "No se pudo registrar el pago.");
  }

  revalidatePath(PATH);
  revalidatePath("/tesoreria/ordenes-de-pago");
  revalidatePath("/compras/comprobantes");
  return { ok: true, id: data?.id_pago ?? null, error: null, code: null };
}
