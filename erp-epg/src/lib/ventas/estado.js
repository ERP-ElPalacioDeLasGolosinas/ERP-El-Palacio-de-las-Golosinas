/**
 * Estados de la venta mayorista (`comprobante_venta.estado`).
 * "Despachado" se marca desde la venta; "Pagado" lo pone el cobro en Tesorería.
 */

/** @typedef {"En preparación" | "Despachado" | "Pagado"} EstadoVenta */

/** @type {EstadoVenta[]} */
export const ESTADOS_VENTA = ["En preparación", "Despachado", "Pagado"];

/** @type {Record<EstadoVenta, string>} */
const BADGE_ESTADO = {
  "En preparación": "palacio-badge-lleno",
  Despachado: "palacio-badge-disponible",
  Pagado: "palacio-badge-activo",
};

/**
 * @param {string | null | undefined} estado
 * @returns {string}
 */
export function badgeEstadoVenta(estado) {
  return BADGE_ESTADO[estado] ?? "palacio-badge-inactivo";
}
