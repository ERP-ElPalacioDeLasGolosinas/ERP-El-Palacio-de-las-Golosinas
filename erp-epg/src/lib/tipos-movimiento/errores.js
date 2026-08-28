/**
 * Mapeo de los ERRCODE custom de las funciones `fn_tipo_movimiento_*` a mensajes de UI.
 *
 * | Código | Campo  | Significado                                          |
 * |--------|--------|-------------------------------------------------------|
 * | TMV01  | nombre | Nombre vacío                                          |
 * | TMV02  | nombre | Nombre duplicado                                      |
 * | TMV03  | —      | El tipo de movimiento ya no existe (recargar tabla)   |
 * | TMV04  | signo  | Signo inválido (debe ser 1 o -1)                      |
 * | TMV05  | signo  | Signo obligatorio                                     |
 */

/** @typedef {{ field: "nombre" | "signo" | null, message: string, reload?: boolean }} ErrorUI */

const MAPA = {
  TMV01: { field: "nombre", message: "El nombre es obligatorio." },
  TMV02: {
    field: "nombre",
    message: "Ya existe un tipo de movimiento con ese nombre.",
  },
  TMV03: {
    field: null,
    message:
      "El tipo de movimiento ya no existe (puede haber sido eliminado por otro usuario).",
    reload: true,
  },
  TMV04: {
    field: "signo",
    message: "El signo debe ser positivo (entrada) o negativo (salida).",
  },
  TMV05: {
    field: "signo",
    message: "Debés definir el signo del tipo de movimiento.",
  },
};

/**
 * @param {{ code?: string | null, error?: string | null } | null | undefined} result
 * @returns {ErrorUI}
 */
export function mapErrorTipoMovimiento(result) {
  const code = result?.code ?? null;

  if (code && MAPA[code]) {
    return MAPA[code];
  }

  return {
    field: null,
    message: result?.error || "No se pudo completar la operación.",
  };
}
