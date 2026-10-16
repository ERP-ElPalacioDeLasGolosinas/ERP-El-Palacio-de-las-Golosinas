"use server";

import { revalidatePath } from "next/cache";
import { notificarEstadoPedido } from "@/lib/email/pedido";
import { createClient } from "@/lib/supabase/server";
import { ESTADOS_PEDIDO_WEB } from "@/lib/pedidos-web/estado";

const PATH = "/ventas/pedidos-web";

// Estados cuyo cambio se avisa por mail al cliente (S5-8b). "En preparación" no tiene mensaje.
const ESTADOS_QUE_NOTIFICAN = ["Pagado", "Despachado", "Cancelado"];

/**
 * Lista pedidos web vía `fn_pedido_web_listar`.
 *
 * @param {{ estado?: string | null, desde?: string | null, hasta?: string | null }} [filtros]
 * @returns {Promise<{ data: Array<Record<string, any>> | null, error: string | null }>}
 */
export async function listarPedidosWeb(filtros = {}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_pedido_web_listar", {
    p_estado: ESTADOS_PEDIDO_WEB.includes(filtros.estado) ? filtros.estado : null,
    p_desde: filtros.desde || null,
    p_hasta: filtros.hasta || null,
  });

  if (error) {
    return { data: null, error: "No se pudieron cargar los pedidos web." };
  }

  return { data: data ?? [], error: null };
}

/**
 * Detalle de un pedido web vía `fn_pedido_web_obtener`. `data` es null si no existe.
 *
 * @param {string} idPedido
 * @returns {Promise<{ data: Record<string, any> | null, error: string | null }>}
 */
export async function obtenerPedidoWeb(idPedido) {
  if (!idPedido) return { data: null, error: "Falta el identificador del pedido." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_pedido_web_obtener", { p_id: idPedido });

  if (error) {
    return { data: null, error: "No se pudo cargar el pedido." };
  }

  return { data: (Array.isArray(data) ? data[0] : data) ?? null, error: null };
}

/**
 * Cambia el estado del pedido (`fn_pedido_web_cambiar_estado`) y avisa al cliente por mail sin
 * esperar el resultado del envío.
 *
 * @param {string} idPedido
 * @param {string} estado Estado destino.
 * @param {string | null} [referencia] Referencia del movimiento bancario (solo al pasar a Pagado).
 * @returns {Promise<{ ok: boolean, error: string | null, code?: string | null }>}
 */
export async function cambiarEstadoPedidoWeb(idPedido, estado, referencia = null) {
  if (!idPedido || !ESTADOS_PEDIDO_WEB.includes(estado)) {
    return { ok: false, code: null, error: "Datos del cambio de estado inválidos." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_pedido_web_cambiar_estado", {
    p_id: idPedido,
    p_estado: estado,
    p_referencia: referencia?.trim() || null,
  });

  if (error) {
    return {
      ok: false,
      code: error.code ?? null,
      error: error.message || "No se pudo cambiar el estado del pedido.",
    };
  }

  const pedido = Array.isArray(data) ? data[0] : data;
  if (pedido && ESTADOS_QUE_NOTIFICAN.includes(estado)) {
    void notificarEstadoPedido({
      email: pedido.mail_cliente,
      numero: pedido.numero,
      estado,
      importeTotal: pedido.importe_total,
    });
  }

  revalidatePath(PATH);
  revalidatePath(`${PATH}/${idPedido}`);
  revalidatePath("/tesoreria/cobranzas");
  revalidatePath("/inventario/stock");
  revalidatePath("/inventario/movimientos");
  return { ok: true, error: null, code: null };
}
