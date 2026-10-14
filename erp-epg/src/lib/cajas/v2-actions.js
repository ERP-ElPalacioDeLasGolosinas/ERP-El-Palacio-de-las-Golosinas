"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * EXPERIMENTAL · Flujo de cajas con sesiones autorizadas por el gerente
 * (`fn_cajav2_*`, rama feat/ventas-cajas-nuevo-flujo).
 */

const PATH = "/ventas/cajas";

/** @param {{ message?: string, code?: string } | null | undefined} error @param {string} fallback */
function errorResult(error, fallback) {
  return { ok: false, code: error?.code ?? null, error: error?.message || fallback };
}

/** @param {unknown} valor @returns {string | null} */
function textoOpcional(valor) {
  if (valor == null) return null;
  const s = String(valor).trim();
  return s.length > 0 ? s : null;
}

/** @param {unknown} valor @returns {number | null} */
function numero(valor) {
  if (valor == null || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function revalidar(idCaja) {
  revalidatePath(PATH);
  revalidatePath(`${PATH}/historial`);
  if (idCaja) revalidatePath(`${PATH}/${idCaja}`);
}

/**
 * Todas las cajas físicas activas con su sesión viva (o `sesion: null` si está libre).
 *
 * @returns {Promise<{ data: Array<Record<string, any>> | null, error: string | null }>}
 */
export async function obtenerPanelCajas() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_cajav2_panel");
  if (error) return { data: null, error: "No se pudieron cargar las cajas." };
  return { data: data ?? [], error: null };
}

/** Sesión viva del usuario actual (Pendiente, Abierta o Cierre solicitado), o null. */
export async function obtenerMiSesion() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_cajav2_mi_sesion");
  if (error) return { data: null, error: "No se pudo cargar tu sesión de caja." };
  return { data: data ?? null, error: null };
}

/** Sesión cajav2 de una caja (null si la caja se abrió con el flujo anterior). @param {string} idCaja */
export async function obtenerSesionDeCaja(idCaja) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_cajav2_sesion_de_caja", { p_id_caja: idCaja });
  if (error) return { data: null, error: "No se pudo cargar la sesión de la caja." };
  return { data: data ?? null, error: null };
}

/**
 * Alta o modificación de una caja física (solo gerente).
 *
 * @param {{ id_registradora?: string | null, numero: number | string, nombre?: string | null, id_deposito: string, activa?: boolean }} entrada
 */
export async function guardarCajaRegistradora(entrada) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_cajav2_registradora_guardar", {
    p_id_registradora: entrada.id_registradora || null,
    p_numero: numero(entrada.numero),
    p_nombre: textoOpcional(entrada.nombre),
    p_id_deposito: entrada.id_deposito || null,
    p_activa: entrada.activa ?? true,
  });
  if (error) return errorResult(error, "No se pudo guardar la caja.");
  revalidar();
  return { ok: true, error: null, code: null };
}

/**
 * El empleado elige una caja libre y pide abrirla con el monto inicial.
 *
 * @param {{ id_registradora: string, monto_inicial: number | string, observaciones?: string | null }} entrada
 */
export async function solicitarAperturaCaja(entrada) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_cajav2_solicitar_apertura", {
    p_id_registradora: entrada.id_registradora || null,
    p_monto_inicial: numero(entrada.monto_inicial),
    p_observaciones: textoOpcional(entrada.observaciones),
  });
  if (error) return errorResult(error, "No se pudo pedir la apertura.");
  revalidar();
  return { ok: true, error: null, code: null };
}

/**
 * Empleados `Empleado Ventas` sin sesión viva, candidatos para levantar una caja (solo gerente).
 *
 * @returns {Promise<{ data: Array<{ id_usuario: string, nombre_completo: string }> | null, error: string | null }>}
 */
export async function listarEmpleadosDisponibles() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_cajav2_empleados_disponibles");
  if (error) return { data: null, error: "No se pudieron cargar los empleados disponibles." };
  return { data: data ?? [], error: null };
}

/**
 * El gerente levanta una caja física para un empleado, con el monto inicial (sesión ya autorizada).
 *
 * @param {{ id_registradora: string, id_empleado: string, monto_inicial: number | string, observaciones?: string | null }} entrada
 */
export async function levantarCaja(entrada) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_cajav2_levantar", {
    p_id_registradora: entrada.id_registradora || null,
    p_id_empleado: entrada.id_empleado || null,
    p_monto_inicial: numero(entrada.monto_inicial),
    p_observaciones: textoOpcional(entrada.observaciones),
  });
  if (error) return errorResult(error, "No se pudo levantar la caja.");
  revalidar(data?.id_caja);
  return { ok: true, error: null, code: null };
}

/** @param {{ id_sesion: string }} entrada */
export async function aprobarAperturaCaja(entrada) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_cajav2_aprobar_apertura", { p_id_sesion: entrada.id_sesion });
  if (error) return errorResult(error, "No se pudo aprobar la apertura.");
  revalidar(data?.id_caja);
  return { ok: true, error: null, code: null };
}

/** @param {{ id_sesion: string, motivo?: string | null }} entrada */
export async function rechazarAperturaCaja(entrada) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_cajav2_rechazar_apertura", {
    p_id_sesion: entrada.id_sesion,
    p_motivo: textoOpcional(entrada.motivo),
  });
  if (error) return errorResult(error, "No se pudo rechazar la apertura.");
  revalidar();
  return { ok: true, error: null, code: null };
}

/** @param {{ id_sesion: string, id_caja: string, observaciones?: string | null }} entrada */
export async function solicitarCierreCaja(entrada) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_cajav2_solicitar_cierre", {
    p_id_sesion: entrada.id_sesion,
    p_observaciones: textoOpcional(entrada.observaciones),
  });
  if (error) return errorResult(error, "No se pudo pedir el cierre.");
  revalidar(entrada.id_caja);
  return { ok: true, error: null, code: null };
}

/** @param {{ id_sesion: string, id_caja: string, motivo?: string | null }} entrada */
export async function rechazarCierreCaja(entrada) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_cajav2_rechazar_cierre", {
    p_id_sesion: entrada.id_sesion,
    p_motivo: textoOpcional(entrada.motivo),
  });
  if (error) return errorResult(error, "No se pudo rechazar el cierre.");
  revalidar(entrada.id_caja);
  return { ok: true, error: null, code: null };
}

/** Cierre definitivo (solo gerente). @param {{ id_sesion: string, id_caja: string, observaciones?: string | null }} entrada */
export async function cerrarSesionCaja(entrada) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_cajav2_cerrar", {
    p_id_sesion: entrada.id_sesion,
    p_observaciones: textoOpcional(entrada.observaciones),
  });
  if (error) return errorResult(error, "No se pudo cerrar la caja.");
  revalidar(entrada.id_caja);
  return { ok: true, error: null, code: null };
}
