"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const PATH = "/ventas/cajas";

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

async function usuarioActual(supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

const SIN_SESION = { ok: false, code: null, error: "Debés iniciar sesión para operar la caja." };

/**
 * Caja completa (abierta o cerrada) vía `fn_caja_obtener`.
 *
 * @param {string} idCaja
 */
export async function obtenerCaja(idCaja) {
  if (!idCaja) return { data: null, error: "Falta el identificador de la caja." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_caja_obtener", { p_id_caja: idCaja });

  if (error) {
    return { data: null, error: "No se pudo cargar la caja." };
  }

  return { data: data ?? null, error: null };
}

/**
 * Historial de cajas vía `fn_caja_listar`.
 *
 * @param {{ desde?: string | null, hasta?: string | null, estado?: string | null }} [filtros]
 * @returns {Promise<{ data: Array<Record<string, unknown>> | null, error: string | null }>}
 */
export async function listarCajas(filtros = {}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_caja_listar", {
    p_desde: filtros.desde || null,
    p_hasta: filtros.hasta || null,
    p_estado: filtros.estado || null,
  });

  if (error) {
    return { data: null, error: "No se pudieron cargar las cajas." };
  }

  return { data: data ?? [], error: null };
}

/**
 * V-14 · Abre la caja del punto de venta 1 con su monto inicial en efectivo.
 *
 * @param {{ monto_inicial: number | string, id_deposito: string, observaciones?: string | null }} entrada
 * @returns {Promise<{ ok: boolean, id?: string | null, error: string | null, code?: string | null }>}
 */
export async function abrirCaja(entrada) {
  const supabase = await createClient();
  const user = await usuarioActual(supabase);
  if (!user) return SIN_SESION;

  const { data, error } = await supabase.rpc("fn_caja_abrir", {
    p_monto_inicial: numero(entrada.monto_inicial),
    p_observaciones: textoOpcional(entrada.observaciones),
    p_creado_por: user.id,
    p_id_deposito: entrada.id_deposito || null,
  });

  if (error) return errorResult(error, "No se pudo abrir la caja.");

  revalidatePath(PATH);
  revalidatePath(`${PATH}/historial`);
  return { ok: true, id: data?.id_caja ?? null, error: null, code: null };
}

/**
 * Asigna el depósito a una caja abierta que todavía no lo tiene. Solo una vez.
 *
 * @param {{ id_caja: string, id_deposito: string }} entrada
 * @returns {Promise<{ ok: boolean, error: string | null, code?: string | null }>}
 */
export async function asignarDepositoCaja(entrada) {
  const supabase = await createClient();
  const user = await usuarioActual(supabase);
  if (!user) return SIN_SESION;

  const { error } = await supabase.rpc("fn_caja_asignar_deposito", {
    p_id_caja: entrada.id_caja || null,
    p_id_deposito: entrada.id_deposito || null,
  });

  if (error) return errorResult(error, "No se pudo asignar el depósito.");

  revalidatePath(PATH);
  revalidatePath(`${PATH}/historial`);
  revalidatePath(`${PATH}/${entrada.id_caja}`);
  revalidatePath("/ventas/ordenes/nuevo");
  return { ok: true, error: null, code: null };
}

/**
 * V-15 · Ingreso o egreso manual de caja.
 *
 * @param {{ id_caja: string, tipo: "Ingreso" | "Egreso", id_medio_pago: string, importe: number | string, motivo: string, referencia?: string | null }} entrada
 * @returns {Promise<{ ok: boolean, error: string | null, code?: string | null }>}
 */
export async function registrarMovimientoCaja(entrada) {
  const supabase = await createClient();
  const user = await usuarioActual(supabase);
  if (!user) return SIN_SESION;

  const { error } = await supabase.rpc("fn_caja_movimiento_registrar", {
    p_id_caja: entrada.id_caja || null,
    p_tipo: entrada.tipo || null,
    p_id_medio_pago: entrada.id_medio_pago || null,
    p_importe: numero(entrada.importe),
    p_motivo: textoOpcional(entrada.motivo),
    p_referencia: textoOpcional(entrada.referencia),
    p_creado_por: user.id,
  });

  if (error) return errorResult(error, "No se pudo registrar el movimiento.");

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

/**
 * V-17 · Arqueo: registra el efectivo contado contra el saldo teórico.
 *
 * @param {{ id_caja: string, saldo_fisico: number | string, observaciones?: string | null }} entrada
 * @returns {Promise<{ ok: boolean, error: string | null, code?: string | null }>}
 */
export async function realizarArqueo(entrada) {
  const supabase = await createClient();
  const user = await usuarioActual(supabase);
  if (!user) return SIN_SESION;

  const { error } = await supabase.rpc("fn_caja_arqueo_realizar", {
    p_id_caja: entrada.id_caja || null,
    p_saldo_fisico: numero(entrada.saldo_fisico),
    p_observaciones: textoOpcional(entrada.observaciones),
    p_creado_por: user.id,
  });

  if (error) return errorResult(error, "No se pudo registrar el arqueo.");

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

/**
 * V-18 · Cierra la caja (exige un arqueo posterior al último movimiento).
 *
 * @param {{ id_caja: string, observaciones?: string | null }} entrada
 * @returns {Promise<{ ok: boolean, id?: string | null, error: string | null, code?: string | null }>}
 */
export async function cerrarCaja(entrada) {
  const supabase = await createClient();
  const user = await usuarioActual(supabase);
  if (!user) return SIN_SESION;

  const { data, error } = await supabase.rpc("fn_caja_cerrar", {
    p_id_caja: entrada.id_caja || null,
    p_observaciones: textoOpcional(entrada.observaciones),
    p_creado_por: user.id,
  });

  if (error) return errorResult(error, "No se pudo cerrar la caja.");

  revalidatePath(PATH);
  revalidatePath(`${PATH}/historial`);
  return { ok: true, id: data?.id_caja ?? null, error: null, code: null };
}
