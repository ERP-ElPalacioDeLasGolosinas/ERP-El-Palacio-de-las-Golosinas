/**
 * Mapeo de los ERRCODE custom de las funciones `fn_cuenta_tesoreria_*`
 * a mensajes de UI.
 *
 * | Código | Campo  | Significado                                       |
 * |--------|--------|--------------------------------------------------|
 * | CTA01  | nombre | Nombre vacío                                      |
 * | CTA02  | nombre | Nombre duplicado                                  |
 * | CTA03  | —      | La cuenta ya no existe (recargar tabla)           |
 * | CTA04  | —      | Reservado (T-07/T-08): cuenta con movimientos     |
 * | CTA05  | —      | Reservado (T-07/T-08): cuenta inactiva en uso     |
 */

/** @typedef {{ field: "nombre" | null, message: string, reload?: boolean }} ErrorUI */

const MAPA = {
  CTA01: { field: "nombre", message: "El nombre es obligatorio." },
  CTA02: {
    field: "nombre",
    message: "Ya existe una cuenta de tesorería con ese nombre.",
  },
  CTA03: {
    field: null,
    message:
      "La cuenta de tesorería ya no existe (puede haber sido eliminada por otro usuario).",
    reload: true,
  },
};

/**
 * @param {{ code?: string | null, error?: string | null } | null | undefined} result
 * @returns {ErrorUI}
 */
export function mapErrorCuentaTesoreria(result) {
  const code = result?.code ?? null;

  if (code && MAPA[code]) {
    return MAPA[code];
  }

  return {
    field: null,
    message: result?.error || "No se pudo completar la operación.",
  };
}
