/**
 * Estados del pedido web (`pedido_web.estado`, enum `estado_pedido_web`).
 */

/** @typedef {"Pendiente de pago" | "Pagado" | "En preparación" | "Listo para retirar" | "Despachado" | "Retirado" | "Cancelado"} EstadoPedidoWeb */

/** @type {EstadoPedidoWeb[]} */
export const ESTADOS_PEDIDO_WEB = [
  "Pendiente de pago",
  "Pagado",
  "En preparación",
  "Listo para retirar",
  "Despachado",
  "Retirado",
  "Cancelado",
];

/** Valor del filtro que agrupa lo pendiente de preparar (Pagado + En preparación). */
export const FILTRO_A_PREPARAR = "a_preparar";

/** @type {Record<EstadoPedidoWeb, string>} */
const BADGE_ESTADO = {
  "Pendiente de pago": "palacio-badge-lleno",
  Pagado: "palacio-badge-activo",
  "En preparación": "palacio-badge-lleno",
  "Listo para retirar": "palacio-badge-activo",
  Despachado: "palacio-badge-disponible",
  Retirado: "palacio-badge-disponible",
  Cancelado: "palacio-badge-inactivo",
};

/**
 * @param {string | null | undefined} estado
 * @returns {string}
 */
export function badgeEstadoPedidoWeb(estado) {
  return BADGE_ESTADO[estado] ?? "palacio-badge-inactivo";
}
