/**
 * Mapeo de los ERRCODE custom de las funciones `fn_marca_*` a mensajes de UI.
 *
 * | Código | Campo  | Significado                                      |
 * |--------|--------|--------------------------------------------------|
 * | MRC01  | nombre | Nombre vacío                                     |
 * | MRC02  | nombre | Nombre duplicado                                 |
 * | MRC03  | —      | La marca ya no existe (recargar tabla)           |
 */

/** @typedef {{ field: "nombre" | null, message: string, reload?: boolean }} ErrorUI */

const MAPA = {
  MRC01: { field: "nombre", message: "El nombre es obligatorio." },
  MRC02: {
    field: "nombre",
    message: "Ya existe una marca con ese nombre.",
  },
  MRC03: {
    field: null,
    message:
      "La marca ya no existe (puede haber sido eliminada por otro usuario).",
    reload: true,
  },
};

/**
 * @param {{ code?: string | null, error?: string | null } | null | undefined} result
 * @returns {ErrorUI}
 */
export function mapErrorMarca(result) {
  const code = result?.code ?? null;

  if (code && MAPA[code]) {
    return MAPA[code];
  }

  return {
    field: null,
    message: result?.error || "No se pudo completar la operación.",
  };
}
