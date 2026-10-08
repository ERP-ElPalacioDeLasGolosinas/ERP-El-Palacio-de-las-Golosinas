"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * @returns {Promise<{ data: Array<{
 *   id_proveedor: string,
 *   nombre_proveedor: string,
 *   activo: boolean,
 *   saldo: number,
 *   cantidad_movimientos: number,
 * }> | null, error: string | null }>}
 */
export async function listarCuentasProveedores() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_cuenta_corriente_proveedor_listar");
  if (error) {
    return { data: null, error: "No se pudieron cargar las cuentas de proveedores." };
  }
  return { data: data ?? [], error: null };
}

/**
 * @param {string} idProveedor
 * @param {{ desde?: string | null, hasta?: string | null }} [filtros]
 */
export async function listarMovimientosProveedor(idProveedor, filtros = {}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_cuenta_corriente_proveedor_movimientos", {
    p_id_proveedor: idProveedor,
    p_desde: filtros.desde || null,
    p_hasta: filtros.hasta || null,
  });
  if (error) {
    return { data: null, error: "No se pudo cargar el historial del proveedor." };
  }
  return { data: data ?? [], error: null };
}

/**
 * @returns {Promise<{ data: Array<{
 *   id_cliente: string,
 *   nombre_cliente: string,
 *   activo: boolean,
 *   saldo: number,
 *   cantidad_movimientos: number,
 * }> | null, error: string | null }>}
 */
export async function listarCuentasClientes() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_cuenta_corriente_cliente_listar");
  if (error) {
    return { data: null, error: "No se pudieron cargar las cuentas de clientes." };
  }
  return { data: data ?? [], error: null };
}

/**
 * @param {string} idCliente
 * @param {{ desde?: string | null, hasta?: string | null }} [filtros]
 */
export async function listarMovimientosCliente(idCliente, filtros = {}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_cuenta_corriente_cliente_movimientos", {
    p_id_cliente: idCliente,
    p_desde: filtros.desde || null,
    p_hasta: filtros.hasta || null,
  });
  if (error) {
    return { data: null, error: "No se pudo cargar el historial del cliente." };
  }
  return { data: data ?? [], error: null };
}
