/**
 * Mapeo de los ERRCODE custom de `fn_lote_registrar_completo` a mensajes de UI.
 *
 * | Código | Significado                                  |
 * |--------|---------------------------------------------|
 * | LOT01  | El lote no tiene productos para registrar    |
 * | LOT02  | Uno de los productos cargados ya no existe   |
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
