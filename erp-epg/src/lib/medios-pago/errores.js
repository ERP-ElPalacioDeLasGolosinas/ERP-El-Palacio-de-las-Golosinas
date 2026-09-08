/**
 * Mapeo de los ERRCODE custom de las funciones `fn_medio_pago_*` a mensajes de UI.
 *
 * | Código | Campo  | Significado                                      |
 * |--------|--------|--------------------------------------------------|
 * | MDP01  | nombre | Nombre vacío                                     |
 * | MDP02  | nombre | Nombre duplicado                                 |
 * | MDP03  | —      | El medio de pago ya no existe (recargar tabla)   |
 * | MDP04  | tipo   | Tipo no indicado                                 |
 * | MDP05  | cuentas| Una cuenta enlazada no existe o está inactiva    |
 */

/** @typedef {{ field: "nombre" | "tipo" | "cuentas" | null, message: string, reload?: boolean }} ErrorUI */

const MAPA = {
  MDP01: { field: "nombre", message: "El nombre es obligatorio." },
  MDP02: {
    field: "nombre",
    message: "Ya existe un medio de pago con ese nombre.",
  },
  MDP03: {
    field: null,
    message:
      "El medio de pago ya no existe (puede haber sido eliminado por otro usuario).",
    reload: true,
  },
  MDP04: { field: "tipo", message: "Elegí el tipo del medio de pago." },
  MDP05: {
    field: "cuentas",
    message:
      "Alguna de las cuentas seleccionadas ya no existe o está inactiva. Actualizá la lista.",
    reload: true,
  },
};

/**
 * @param {{ code?: string | null, error?: string | null } | null | undefined} result
 * @returns {ErrorUI}
 */
export function mapErrorMedioPago(result) {
  const code = result?.code ?? null;

  if (code && MAPA[code]) {
    return MAPA[code];
  }

  return {
    field: null,
    message: result?.error || "No se pudo completar la operación.",
  };
}
