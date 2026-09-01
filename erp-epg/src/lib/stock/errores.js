/**
 * Mapeo de los ERRCODE custom de `fn_lote_registrar_completo` / `fn_lote_eliminar`
 * a mensajes de UI.
 *
 * | Código | Significado                                                  |
 * |--------|---------------------------------------------------------------|
 * | LOT01  | El lote no tiene productos para registrar                    |
 * | LOT02  | Uno de los productos cargados ya no existe                   |
 * | LOT03  | El lote no existe                                             |
 * | LOT04  | El lote tiene stock consumido, no se puede eliminar           |
 * | LOT05  | Inconsistencia de stock detectada (quedaría negativo)         |
 * | LOT06  | No se encontró un tipo de movimiento requerido                |
 * | LOT07  | La compra asociada no existe                                  |
 * | LOT08  | La compra ya tiene stock aplicado                             |
 * | LOT09  | La compra no está en un estado válido para recepción          |
 */

/** @typedef {{ field: string | null, message: string }} ErrorUI */

const MAPA = {
  LOT01: {
    field: null,
    message: "Cargá al menos un producto antes de registrar el lote.",
  },
  LOT02: {
    field: null,
    message: "Uno de los productos cargados ya no existe.",
  },
  LOT03: {
    field: null,
    message: "El lote indicado no existe.",
  },
  LOT04: {
    field: null,
    message:
      "No se puede eliminar el lote: ya tiene stock consumido. Utilizá un movimiento de corrección en su lugar.",
  },
  LOT05: {
    field: null,
    message:
      "No se pudo eliminar el lote: se detectó una inconsistencia de stock.",
  },
  LOT06: {
    field: null,
    message:
      "No se encontró un tipo de movimiento requerido para la operación. Contactá al administrador.",
  },
  LOT07: {
    field: null,
    message: "La compra seleccionada no existe.",
  },
  LOT08: {
    field: null,
    message:
      "Esa compra ya tiene stock aplicado. No se puede volver a recibir mercadería contra ella.",
  },
  LOT09: {
    field: null,
    message:
      "La compra no está en un estado válido para recibir mercadería (debe estar Pendiente o Enviada).",
  },
};

/**
 * @param {{ code?: string | null, error?: string | null } | null | undefined} result
 * @returns {ErrorUI}
 */
export function mapErrorLote(result) {
  const code = result?.code ?? null;

  if (code && MAPA[code]) {
    return MAPA[code];
  }

  return {
    field: null,
    message: result?.error || "No se pudo registrar el lote.",
  };
}
