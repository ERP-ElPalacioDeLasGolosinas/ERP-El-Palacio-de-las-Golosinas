/**
 * Mapeo de los ERRCODE custom de las funciones `fn_tipo_comprobante_*` a mensajes de UI.
 *
 * | Código | Campo  | Significado                                            |
 * |--------|--------|--------------------------------------------------------|
 * | CPB01  | nombre | Nombre vacío                                           |
 * | CPB02  | nombre | Nombre duplicado                                       |
 * | CPB03  | —      | El tipo de comprobante ya no existe (recargar tabla)   |
 * | CPB04  | signo  | Signo inválido (debe ser 1 o -1)                       |
 * | CPB05  | letra  | Letra informada pero no es A, B ni C                   |
 */

/** @typedef {{ field: "nombre" | "signo" | "letra" | null, message: string, reload?: boolean }} ErrorUI */

const MAPA = {
  CPB01: { field: "nombre", message: "El nombre es obligatorio." },
  CPB02: {
    field: "nombre",
    message: "Ya existe un tipo de comprobante con ese nombre.",
  },
  CPB03: {
    field: null,
    message:
      "El tipo de comprobante ya no existe (puede haber sido eliminado por otro usuario).",
    reload: true,
  },
  CPB04: {
    field: "signo",
    message: "El signo debe ser 1 (suma al saldo) o -1 (resta del saldo).",
  },
  CPB05: {
    field: "letra",
    message: "La letra debe ser A, B o C (o dejarse vacía).",
  },
};

/**
 * @param {{ code?: string | null, error?: string | null } | null | undefined} result
 * @returns {ErrorUI}
 */
export function mapErrorTipoComprobante(result) {
  const code = result?.code ?? null;

  if (code && MAPA[code]) {
    return MAPA[code];
  }

  return {
    field: null,
    message: result?.error || "No se pudo completar la operación.",
  };
}
