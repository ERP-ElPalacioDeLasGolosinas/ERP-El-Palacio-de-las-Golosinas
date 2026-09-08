/**
 * Estados del comprobante de proveedor (T-C1 / D-013) y su presentación.
 *
 * El estado lo mantiene la base (`comprobante_proveedor.estado`); acá solo se
 * mapea cada valor a una clase de badge `.palacio-*` para las tablas y el
 * detalle.
 */

/** @typedef {"Pendiente" | "En orden de pago" | "Pagado parcial" | "Pagado" | "Anulado"} EstadoComprobante */

/**
 * Valores del enum `estado_comprobante_proveedor`, en orden de circuito.
 * Los usa el filtro de estado de `/compras/comprobantes` (T-C2).
 *
 * @type {EstadoComprobante[]}
 */
export const ESTADOS_COMPROBANTE = [
  "Pendiente",
  "En orden de pago",
  "Pagado parcial",
  "Pagado",
  "Anulado",
];

/** @type {Record<EstadoComprobante, string>} */
const BADGE_ESTADO = {
  Pendiente: "palacio-badge-lleno",
  "En orden de pago": "palacio-badge-disponible",
  "Pagado parcial": "palacio-badge-disponible",
  Pagado: "palacio-badge-activo",
  Anulado: "palacio-badge-inactivo",
};

/**
 * Clase de badge para un estado de comprobante. Cae a `palacio-badge-inactivo`
 * si el valor no se reconoce.
 *
 * @param {string | null | undefined} estado
 * @returns {string}
 */
export function badgeEstadoComprobante(estado) {
  return BADGE_ESTADO[estado] ?? "palacio-badge-inactivo";
}
