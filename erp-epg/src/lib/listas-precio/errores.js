/**
 * Mapeo de los ERRCODE custom de las funciones `fn_lista_precio_*` a mensajes de UI.
 *
 * | Código | Campo   | Significado                                                |
 * |--------|---------|------------------------------------------------------------|
 * | LPR01  | nombre  | Nombre vacío o repetido                                    |
 * | LPR02  | fechas  | Tipo / fechas faltantes o inválidas                        |
 * | LPR03  | fechas  | Vigencia superpuesta con otra lista del mismo tipo         |
 * | LPR04  | —       | Lista no encontrada (recargar)                             |
 * | LPR05  | —       | Lista vencida: solo lectura (recargar)                     |
 * | LPR06  | —       | Precios / ajuste inválidos                                 |
 */

/** @typedef {{
 *   field: "nombre" | "fechas" | null,
 *   message: string,
 *   reload?: boolean,
 * }} ErrorUI */

const MAPA = {
  LPR01: { field: "nombre", message: "El nombre es obligatorio y no puede repetirse." },
  LPR02: { field: "fechas", message: "Revisá el tipo y las fechas de vigencia." },
  LPR03: {
    field: "fechas",
    message:
      "Las fechas se superponen con otra lista del mismo tipo. Una lista sin fecha de fin bloquea a las posteriores.",
  },
  LPR04: {
    field: null,
    message: "La lista de precios ya no existe.",
    reload: true,
  },
  LPR05: {
    field: null,
    message: "La lista está vencida y es de solo lectura.",
    reload: true,
  },
  LPR06: {
    field: null,
    message: "Revisá los precios o el ajuste porcentual (no puede ser menor a -100).",
  },
};

/**
 * @param {{ code?: string | null, error?: string | null } | null | undefined} result
 * @returns {ErrorUI}
 */
export function mapErrorListaPrecio(result) {
  const code = result?.code ?? null;

  if (code && MAPA[code]) {
    // El mensaje del servidor es más específico (p. ej. cuál fecha falla).
    return { ...MAPA[code], message: result?.error || MAPA[code].message };
  }

  return {
    field: null,
    message: result?.error || "No se pudo completar la operación.",
  };
}
