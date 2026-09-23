"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const PATH = "/ventas/ordenes";

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

/**
 * Facturas activas que aplican a venta (`fn_tipo_comprobante_listar` con
 * `p_aplica_venta`). Combo de tipo de comprobante del alta de venta.
 *
 * @returns {Promise<{ data: Array<{ id_tipo_comprobante: string, nombre_tipo_comprobante: string, letra: string | null }> | null, error: string | null }>}
 */
export async function listarTiposComprobanteVenta() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_tipo_comprobante_listar", {
    p_incluir_inactivos: false,
    p_aplica_venta: true,
  });

  if (error) {
    return { data: null, error: "No se pudieron cargar los tipos de comprobante." };
  }

  return {
    data: (data ?? []).filter((t) => t.activo && t.clase === "factura"),
    error: null,
  };
}

/**
 * Lista ventas mayoristas vía `fn_venta_listar` (V-19).
 *
 * @param {{ idCliente?: string | null, desde?: string | null, hasta?: string | null, estado?: string | null }} [filtros]
 * @returns {Promise<{ data: Array<Record<string, unknown>> | null, error: string | null }>}
 */
export async function listarVentas(filtros = {}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_venta_listar", {
    p_id_cliente: filtros.idCliente || null,
    p_desde: filtros.desde || null,
    p_hasta: filtros.hasta || null,
    p_estado: filtros.estado || null,
  });

  if (error) {
    return { data: null, error: "No se pudieron cargar las ventas." };
  }

  return { data: data ?? [], error: null };
}

/**
 * Venta completa (cabecera + detalle + cobro) vía `fn_venta_obtener`.
 *
 * @param {string} idComprobante
 * @returns {Promise<{ data: { venta: Record<string, any>, detalle: Array<Record<string, any>>, cobro: Record<string, any> | null } | null, error: string | null }>}
 */
export async function obtenerVenta(idComprobante) {
  if (!idComprobante) {
    return { data: null, error: "Falta el identificador de la venta." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_venta_obtener", {
    p_id_comprobante: idComprobante,
  });

  if (error) {
    return { data: null, error: "No se pudo cargar la venta." };
  }

  return { data: data ?? null, error: null };
}

/**
 * Registra una venta mayorista (V-10 / V-11 / S-07): emite el comprobante con
 * número automático y descuenta el stock de cada línea.
 *
 * @param {{
 *   id_cliente: string,
 *   id_tipo_comprobante: string,
 *   fecha_comprobante: string,
 *   observaciones?: string | null,
 *   detalle: Array<{ id_producto: string, id_deposito: string, cantidad: number | string, descuento?: number | string | null }>,
 * }} entrada
 * @returns {Promise<{ ok: boolean, id?: string | null, error: string | null, code?: string | null }>}
 */
export async function registrarVenta(entrada) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      code: null,
      error: "Debés iniciar sesión para registrar una venta.",
    };
  }

  const detalle = (Array.isArray(entrada.detalle) ? entrada.detalle : []).map(
    (l) => ({
      id_producto: l.id_producto || null,
      id_deposito: l.id_deposito || null,
      cantidad: numero(l.cantidad),
      descuento: numero(l.descuento) ?? 0,
    })
  );

  const { data, error } = await supabase.rpc("fn_venta_registrar", {
    p_id_cliente: entrada.id_cliente || null,
    p_id_tipo_comprobante: entrada.id_tipo_comprobante || null,
    p_fecha_comprobante: entrada.fecha_comprobante || null,
    p_observaciones: entrada.observaciones?.trim() || null,
    p_detalle: detalle,
    p_creado_por: user.id,
  });

  if (error) {
    return errorResult(error, "No se pudo registrar la venta.");
  }

  revalidatePath(PATH);
  revalidatePath("/inventario/stock");
  revalidatePath("/inventario/movimientos");
  return { ok: true, id: data?.id_comprobante ?? null, error: null, code: null };
}

/**
 * Pasa la venta de "En preparación" a "Despachado".
 *
 * @param {string} idComprobante
 * @returns {Promise<{ ok: boolean, error: string | null, code?: string | null }>}
 */
export async function despacharVenta(idComprobante) {
  if (!idComprobante) {
    return { ok: false, code: null, error: "Falta el identificador de la venta." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_venta_despachar", {
    p_id_comprobante: idComprobante,
  });

  if (error) {
    return errorResult(error, "No se pudo despachar la venta.");
  }

  revalidatePath(PATH);
  revalidatePath(`${PATH}/${idComprobante}`);
  return { ok: true, error: null, code: null };
}
