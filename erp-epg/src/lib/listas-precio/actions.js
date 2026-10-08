"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ESTADOS_LISTA, TIPOS_LISTA } from "./constantes";

const PATH = "/ventas/listas-de-precios";

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

/**
 * @param {{ tipo?: string | null, estado?: string | null }} [filtros]
 */
export async function listarListasPrecio({ tipo = null, estado = null } = {}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_lista_precio_listar", {
    p_tipo_lista: TIPOS_LISTA.includes(tipo) ? tipo : null,
    p_estado: ESTADOS_LISTA.includes(estado) ? estado : null,
  });

  if (error) {
    return { data: null, error: "No se pudieron cargar las listas de precios." };
  }

  return { data: data ?? [], error: null };
}

/**
 * @param {string} id_lista_precio
 */
export async function obtenerListaPrecio(id_lista_precio) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_lista_precio_obtener", {
    p_id_lista_precio: id_lista_precio,
  });

  if (error) {
    if (error.code === "LPR04" || error.code === "22P02") {
      return { data: null, error: null };
    }
    return { data: null, error: "No se pudo cargar la lista de precios." };
  }

  return { data, error: null };
}

/**
 * @param {{
 *   nombre: string,
 *   tipo: string,
 *   fechaInicio: string,
 *   fechaFin?: string | null,
 *   observaciones?: string | null,
 *   idListaOrigen?: string | null,
 *   ajuste?: number | null,
 * }} input
 */
export async function crearListaPrecio(input) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_lista_precio_crear", {
    p_nombre_lista_precio: input.nombre ?? "",
    p_tipo_lista: input.tipo || null,
    p_fecha_inicio: input.fechaInicio || null,
    p_fecha_fin: input.fechaFin || null,
    p_observaciones: input.observaciones || null,
    p_id_lista_origen: input.idListaOrigen || null,
    p_ajuste_porcentaje: input.idListaOrigen ? Number(input.ajuste) || 0 : 0,
  });

  if (error) {
    return errorResult(error, "No se pudo crear la lista de precios.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null, id: data?.id_lista_precio ?? null };
}

/**
 * @param {string} id_lista_precio
 * @param {{
 *   nombre: string,
 *   fechaInicio: string,
 *   fechaFin?: string | null,
 *   observaciones?: string | null,
 * }} input
 */
export async function actualizarListaPrecio(id_lista_precio, input) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_lista_precio_modificar", {
    p_id_lista_precio: id_lista_precio,
    p_nombre_lista_precio: input.nombre ?? "",
    p_fecha_inicio: input.fechaInicio || null,
    p_fecha_fin: input.fechaFin || null,
    p_observaciones: input.observaciones || null,
  });

  if (error) {
    return errorResult(error, "No se pudo guardar la lista de precios.");
  }

  revalidatePath(PATH);
  revalidatePath(`${PATH}/${id_lista_precio}`);
  return { ok: true, error: null, code: null };
}

/**
 * Upsert de precios.
 *
 * @param {string} id_lista_precio
 * @param {Array<{ id_producto: string, precio: number }>} precios
 */
export async function guardarPreciosLista(id_lista_precio, precios) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_lista_precio_precios_guardar", {
    p_id_lista_precio: id_lista_precio,
    p_precios: precios.map((p) => ({
      id_producto: p.id_producto,
      precio: Number(p.precio),
    })),
  });

  if (error) {
    return errorResult(error, "No se pudieron guardar los precios.");
  }

  revalidatePath(PATH);
  revalidatePath(`${PATH}/${id_lista_precio}`);
  return { ok: true, error: null, code: null };
}

/**
 * @param {string} id_lista_precio
 * @param {string} id_producto
 */
export async function quitarPrecioLista(id_lista_precio, id_producto) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_lista_precio_precio_quitar", {
    p_id_lista_precio: id_lista_precio,
    p_id_producto: id_producto,
  });

  if (error) {
    return errorResult(error, "No se pudo quitar el artículo de la lista.");
  }

  revalidatePath(PATH);
  revalidatePath(`${PATH}/${id_lista_precio}`);
  return { ok: true, error: null, code: null };
}
