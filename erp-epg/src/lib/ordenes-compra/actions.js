"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const PATH = "/compras/ordenes";

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
 * @param {{ idProveedor?: string | null, estado?: string | null, desde?: string | null, hasta?: string | null }} [filtros]
 */
export async function listarOrdenes(filtros = {}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_orden_compra_listar", {
    p_id_proveedor: filtros.idProveedor || null,
    p_estado: filtros.estado || null,
    p_desde: filtros.desde || null,
    p_hasta: filtros.hasta || null,
  });

  if (error) {
    return { data: null, error: "No se pudieron cargar las órdenes de compra." };
  }

  return { data: data ?? [], error: null };
}

/** @param {string} idOrden */
export async function obtenerOrden(idOrden) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_orden_compra_obtener", {
    p_id_orden_compra: idOrden,
  });

  if (error) {
    return { data: null, error: "No se pudo cargar la orden de compra." };
  }

  return { data: data ?? null, error: null };
}

/**
 * @param {{
 *   id_proveedor: string,
 *   fecha_emision: string,
 *   observaciones?: string | null,
 *   detalle: Array<{ id_producto: string, cantidad: number | string, precio_estimado?: number | string | null }>,
 * }} entrada
 */
export async function registrarOrden(entrada) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, code: null, error: "Debés iniciar sesión para registrar la orden.", id: null };
  }

  const detalle = Array.isArray(entrada.detalle) ? entrada.detalle : [];
  const { data, error } = await supabase.rpc("fn_orden_compra_registrar", {
    p_id_proveedor: entrada.id_proveedor || null,
    p_fecha_emision: entrada.fecha_emision || null,
    p_observaciones: textoOpcional(entrada.observaciones),
    p_detalle: detalle.map((linea) => ({
      id_producto: linea.id_producto || null,
      cantidad: numero(linea.cantidad),
      precio_estimado:
        linea.precio_estimado == null || linea.precio_estimado === ""
          ? null
          : numero(linea.precio_estimado),
    })),
    p_creado_por: user.id,
  });

  if (error) {
    return { ...errorResult(error, "No se pudo registrar la orden de compra."), id: null };
  }

  revalidatePath(PATH);
  return { ok: true, code: null, error: null, id: data?.id_orden_compra ?? null };
}

/** @param {string} idOrden */
export async function cancelarOrden(idOrden) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_orden_compra_cancelar", {
    p_id_orden_compra: idOrden,
  });

  if (error) {
    return errorResult(error, "No se pudo cancelar la orden de compra.");
  }

  revalidatePath(PATH);
  revalidatePath(`${PATH}/${idOrden}`);
  return { ok: true, code: null, error: null };
}
