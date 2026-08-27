/**
 * Mapeo de los ERRCODE custom de las funciones `fn_unidad_medida_*`
 * (definidos en la base) a mensajes de UI, indicando el campo del formulario
 * al que corresponde cada uno cuando aplica.
 *
 * | Código | Campo        | Significado                                  |
 * |--------|--------------|---------------------------------------------|
 * | UMD01  | nombre       | Nombre vacío                                |
 * | UMD02  | nombre       | Nombre duplicado                            |
 * | UMD03  | abreviatura  | Abreviatura duplicada                       |
 * | UMD04  | —            | La unidad ya no existe (recargar tabla)     |
 * | UMD05  | —            | Tiene productos asociados, no se elimina    |
 * | UMD06  | abreviatura  | Abreviatura inválida (`^[a-z]{3}$`)         |
 */

/** @typedef {{ field: "nombre" | "abreviatura" | null, message: string, reload?: boolean }} ErrorUI */

const MAPA = {
  UMD01: { field: "nombre", message: "El nombre no puede estar vacío." },
  UMD02: {
    field: "nombre",
    message: "Ya existe una unidad de medida con ese nombre.",
  },
  UMD03: {
    field: "abreviatura",
    message: "Ya existe una unidad de medida con esa abreviatura.",
  },
  UMD04: {
    field: null,
    message:
      "La unidad de medida ya no existe (puede haber sido eliminada por otro usuario).",
    reload: true,
  },
  UMD06: {
    field: "abreviatura",
    message:
      "La abreviatura debe tener exactamente 3 letras minúsculas (ej: kgs).",
  },
};

/**
 * @param {{ code?: string | null, error?: string | null } | null | undefined} result
 *   El objeto `{ ok:false, error, code }` que devuelven las Server Actions.
 * @returns {ErrorUI}
 */
export function mapErrorUnidadMedida(result) {
  const code = result?.code ?? null;

  if (code && MAPA[code]) {
    return MAPA[code];
  }

  // UMD05 y cualquier otro: el mensaje del RPC ya viene en español y armado
  // (UMD05 incluye el conteo de productos), se muestra tal cual.
  return {
    field: null,
    message: result?.error || "No se pudo completar la operación.",
  };
}
