/**
 * Mapeo de los ERRCODE custom de las funciones `fn_tipo_cliente_*` a mensajes de UI.
 *
 * | Código | Campo        | Significado                                      |
 * |--------|--------------|--------------------------------------------------|
 * | TCL01  | nombre       | Nombre vacío                                     |
 * | TCL02  | lista_precio | Falta lista de precios                           |
 * | TCL03  | nombre       | Nombre duplicado                                 |
 * | TCL04  | —            | Tipo no encontrado (recargar tabla)              |
 */

/** @typedef {{ field: "nombre" | "lista_precio" | null, message: string, reload?: boolean }} ErrorUI */

const MAPA = {
  TCL01: { field: "nombre", message: "El nombre es obligatorio." },
  TCL02: {
    field: "lista_precio",
    message: "Elegí una lista de precios.",
  },
  TCL03: {
    field: "nombre",
    message: "Ya existe un tipo de cliente con ese nombre.",
  },
  TCL04: {
    field: null,
    message:
      "El tipo de cliente ya no existe (puede haber sido eliminado por otro usuario).",
    reload: true,
  },
};

/**
 * @param {{ code?: string | null, error?: string | null } | null | undefined} result
 * @returns {ErrorUI}
 */
export function mapErrorTipoCliente(result) {
  const code = result?.code ?? null;

  if (code && MAPA[code]) {
    return MAPA[code];
  }

  return {
    field: null,
    message: result?.error || "No se pudo completar la operación.",
  };
}
