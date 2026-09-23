"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const PATH = "/tesoreria/cobranzas";

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
 * Lista cobros vía `fn_cobro_listar`.
 *
 * @param {{ idCliente?: string | null, desde?: string | null, hasta?: string | null }} [filtros]
 * @returns {Promise<{ data: Array<Record<string, unknown>> | null, error: string | null }>}
 */
export async function listarCobros(filtros = {}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_cobro_listar", {
    p_id_cliente: filtros.idCliente || null,
    p_desde: filtros.desde || null,
    p_hasta: filtros.hasta || null,
  });

  if (error) {
    return { data: null, error: "No se pudieron cargar los cobros." };
  }

  return { data: data ?? [], error: null };
}

/**
 * Cobro completo (cabecera + medios + movimientos de tesorería) vía
 * `fn_cobro_obtener`.
 *
 * @param {string} idCobro
 * @returns {Promise<{ data: { cobro: Record<string, any>, medios: Array<Record<string, any>>, movimientos: Array<Record<string, any>> } | null, error: string | null }>}
 */
export async function obtenerCobro(idCobro) {
  if (!idCobro) {
    return { data: null, error: "Falta el identificador del cobro." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_cobro_obtener", {
    p_id_cobro: idCobro,
  });

  if (error) {
    return { data: null, error: "No se pudo cargar el cobro." };
  }

  return { data: data ?? null, error: null };
}

/**
 * Registra el cobro total de una venta despachada (V-16): imputa cada medio a
 * una cuenta de tesorería, genera los ingresos y deja la venta "Pagado".
 *
 * @param {{
 *   id_comprobante: string,
 *   fecha_cobro?: string | null,
 *   observaciones?: string | null,
 *   medios: Array<{ id_medio_pago: string, id_cuenta_tesoreria: string, importe: number | string, referencia?: string | null }>,
 * }} entrada
 * @returns {Promise<{ ok: boolean, id?: string | null, error: string | null, code?: string | null }>}
 */
export async function registrarCobro(entrada) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      code: null,
      error: "Debés iniciar sesión para registrar un cobro.",
    };
  }

  const medios = (Array.isArray(entrada.medios) ? entrada.medios : []).map(
    (m) => ({
      id_medio_pago: m.id_medio_pago || null,
      id_cuenta_tesoreria: m.id_cuenta_tesoreria || null,
      importe: numero(m.importe),
      referencia: textoOpcional(m.referencia),
    })
  );

  const { data, error } = await supabase.rpc("fn_cobro_registrar", {
    p_id_comprobante: entrada.id_comprobante || null,
    p_fecha_cobro: entrada.fecha_cobro || null,
    p_observaciones: textoOpcional(entrada.observaciones),
    p_medios: medios,
    p_creado_por: user.id,
  });

  if (error) {
    return errorResult(error, "No se pudo registrar el cobro.");
  }

  revalidatePath(PATH);
  revalidatePath("/ventas/ordenes");
  revalidatePath(`/ventas/ordenes/${entrada.id_comprobante}`);
  revalidatePath("/tesoreria/cuentas");
  return { ok: true, id: data?.id_cobro ?? null, error: null, code: null };
}
