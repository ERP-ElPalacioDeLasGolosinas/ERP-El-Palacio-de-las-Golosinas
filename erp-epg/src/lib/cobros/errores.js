/**
 * Mapeo de los ERRCODE custom de `fn_cobro_registrar` a mensajes de UI.
 *
 * | Código | Campo  | Significado                                                      |
 * |--------|--------|------------------------------------------------------------------|
 * | COB01  | —      | La venta no existe                                               |
 * | COB02  | —      | La venta no está despachada o ya está cobrada                    |
 * | COB03  | medios | Sin medios / importe ≤ 0 / la suma no es igual al total          |
 * | COB04  | medios | Medio o cuenta inexistente/inactivo, o cuenta no habilitada      |
 * | COB05  | medios | El medio requiere referencia                                     |
 * | COB06  | medios | Se intentó cobrar con cheque propio                              |
 * | COB07  | fecha  | Fecha de cobro futura                                            |
 */

/** @typedef {{ field: "medios" | "fecha" | null, message: string, reload?: boolean }} ErrorUI */

const MAPA = {
  COB01: { field: null, message: "La venta no existe.", reload: true },
  COB02: {
    field: null,
    message: "La venta no está despachada o ya fue cobrada. Actualizá la página.",
    reload: true,
  },
  COB03: {
    field: "medios",
    message: "La suma de los medios tiene que ser igual al total de la venta.",
  },
  COB04: {
    field: "medios",
    message: "La cuenta elegida no está habilitada para ese medio, o el medio o la cuenta están inactivos.",
    reload: true,
  },
  COB05: { field: "medios", message: "Uno de los medios requiere una referencia." },
  COB06: { field: "medios", message: "Un cobro no puede recibirse con cheque propio." },
  COB07: { field: "fecha", message: "La fecha del cobro no puede ser futura." },
};

const CON_MENSAJE_DE_BASE = new Set(["COB02", "COB03", "COB04", "COB05"]);

/**
 * @param {{ code?: string | null, error?: string | null } | null | undefined} result
 * @returns {ErrorUI}
 */
export function mapErrorCobro(result) {
  const code = result?.code ?? null;

  if (code && MAPA[code]) {
    if (CON_MENSAJE_DE_BASE.has(code) && result?.error) {
      return { ...MAPA[code], message: result.error };
    }
    return MAPA[code];
  }

  return {
    field: null,
    message: result?.error || "No se pudo registrar el cobro.",
  };
}
