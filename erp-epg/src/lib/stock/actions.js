"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Consulta el stock por producto y depósito vía RPC `fn_stock_consultar`.
 * Los filtros son opcionales; sin filtros devuelve todo el stock (> 0).
 *
 * @param {{ id_producto?: string | null, id_deposito?: string | null }} [filtros]
 * @returns {Promise<{ data: Array<{
 *   id_stock: string,
 *   id_producto: string,
 *   codigo_producto: string,
 *   producto: string,
 *   id_unidad_medida: string,
 *   unidad_medida: string,
 *   id_deposito: string,
 *   nombre_deposito: string,
 *   cantidad: number,
 *   editado: string,
 * }> | null, error: string | null }>}
 */
export async function consultarStock(filtros = {}) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("fn_stock_consultar", {
    p_id_producto: filtros.id_producto ?? null,
    p_id_deposito: filtros.id_deposito ?? null,
  });

  if (error) {
    return { data: null, error: "No se pudo consultar el stock." };
  }

  // Orden estable para la tabla: por producto y luego por depósito.
  const rows = (data ?? [])
    .slice()
    .sort(
      (a, b) =>
        a.producto.localeCompare(b.producto, "es") ||
        a.nombre_deposito.localeCompare(b.nombre_deposito, "es")
    );

  return { data: rows, error: null };
}
