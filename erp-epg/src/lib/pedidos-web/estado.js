/**
 * Estados del pedido web (`pedido_web.estado`, enum `estado_pedido_web`).
 */

/** @typedef {"Pendiente de pago" | "Pagado" | "En preparación" | "Despachado" | "Cancelado"} EstadoPedidoWeb */

/** @type {EstadoPedidoWeb[]} */
export const ESTADOS_PEDIDO_WEB = [
  "Pendiente de pago",
  "Pagado",
  "En preparación",
  "Despachado",
  "Cancelado",
];

/** @type {Record<EstadoPedidoWeb, string>} */
const BADGE_ESTADO = {
  "Pendiente de pago": "palacio-badge-lleno",
  Pagado: "palacio-badge-activo",
  "En preparación": "palacio-badge-lleno",
  Despachado: "palacio-badge-disponible",
  Cancelado: "palacio-badge-inactivo",
};

/**
 * @param {string | null | undefined} estado
 * @returns {string}
 */
export function badgeEstadoPedidoWeb(estado) {
  return BADGE_ESTADO[estado] ?? "palacio-badge-inactivo";
}
