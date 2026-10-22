"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Resultado mensual: ventas contra compras netas.
 *
 * @param {string} desde
 * @param {string} hasta
 */
export async function listarResultadoMensual(desde, hasta) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_dashboard_mensual", {
    p_desde: desde,
    p_hasta: hasta,
  });
  if (error) return { data: null, error: "No se pudo cargar el resultado del período." };
  return { data: data ?? [], error: null };
}

/** Ventas del período agrupadas por depósito. */
export async function listarVentasPorDeposito(desde, hasta) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_dashboard_por_deposito", {
    p_desde: desde,
    p_hasta: hasta,
  });
  if (error) return { data: null, error: "No se pudieron cargar las ventas por depósito." };
  return { data: data ?? [], error: null };
}

/** Los cinco productos que más se vendieron en el período. */
export async function listarProductosMasVendidos(desde, hasta) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_dashboard_productos", {
    p_desde: desde,
    p_hasta: hasta,
  });
  if (error) return { data: null, error: "No se pudieron cargar los productos más vendidos." };
  return { data: data ?? [], error: null };
}
