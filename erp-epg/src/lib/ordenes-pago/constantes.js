/**
 * Estados del enum `estado_orden_pago` (Postgres), en orden de circuito.
 * Los usa el filtro de estado de `/tesoreria/ordenes-de-pago` (T-07).
 *
 * @typedef {"Borrador" | "Pendiente de pago" | "Pagada parcial" | "Pagada" | "Cancelada"} EstadoOrdenPago
 * @type {EstadoOrdenPago[]}
 */
export const ESTADOS_ORDEN_PAGO = [
  "Borrador",
  "Pendiente de pago",
  "Pagada parcial",
  "Pagada",
  "Cancelada",
];

/** @type {Record<EstadoOrdenPago, string>} */
const BADGE_ESTADO = {
  Borrador: "palacio-badge-lleno",
  "Pendiente de pago": "palacio-badge-disponible",
  "Pagada parcial": "palacio-badge-disponible",
  Pagada: "palacio-badge-activo",
  Cancelada: "palacio-badge-inactivo",
};

/**
 * Clase de badge `.palacio-*` para un estado de orden de pago.
 *
 * @param {string | null | undefined} estado
 * @returns {string}
 */
export function badgeEstadoOrdenPago(estado) {
  return BADGE_ESTADO[estado] ?? "palacio-badge-inactivo";
}
