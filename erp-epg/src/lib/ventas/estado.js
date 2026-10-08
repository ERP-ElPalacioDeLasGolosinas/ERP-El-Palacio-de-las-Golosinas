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

/**
 * Tipos de venta (`comprobante_venta.tipo_venta`, V-21). La mayorista sigue el
 * circuito despacho → cobro en Tesorería; las otras dos se cobran en la caja
 * abierta y quedan "Pagado" al registrarse.
 *
 * @typedef {"Mayorista" | "Minorista" | "Consumidor final"} TipoVenta
 */

/** @type {TipoVenta[]} */
export const TIPOS_VENTA = ["Mayorista", "Minorista", "Consumidor final"];

/** @param {string | null | undefined} tipo */
export function seCobraEnCaja(tipo) {
  return tipo === "Minorista" || tipo === "Consumidor final";
}

/** Lista de precios que usa cada tipo de venta. @param {string | null | undefined} tipo */
export function listaDeTipoVenta(tipo) {
  return tipo === "Mayorista" ? "Mayorista" : "Minorista";
}
