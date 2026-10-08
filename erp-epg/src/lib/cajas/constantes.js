/** Valores del enum `estado_caja`. */
export const ESTADOS_CAJA = ["Abierta", "Cerrada"];

/**
 * V-17 · Diferencia de arqueo (en $, en valor absoluto) a partir de la cual se
 * muestra la advertencia visual. No bloquea el cierre.
 */
export const UMBRAL_DIFERENCIA_ARQUEO = 500;

/** Medios que la caja no acepta (mismo criterio que `_fn_caja_medio_validar`). */
export const TIPOS_MEDIO_NO_CAJA = new Set(["Cheque propio"]);

/**
 * Medios de un cobro en caja que acreditan una cuenta de tesorería vinculada.
 * Efectivo y Mercado Pago quedan solo en la caja.
 */
export const TIPOS_MEDIO_TESORERIA = new Set(["Transferencia", "Cheque de terceros"]);

/**
 * @param {string | null | undefined} estado
 * @returns {string}
 */
export function badgeEstadoCaja(estado) {
  return estado === "Abierta" ? "palacio-badge-activo" : "palacio-badge-inactivo";
}
