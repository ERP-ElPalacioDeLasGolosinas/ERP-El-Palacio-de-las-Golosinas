/**
 * Mapeo de los ERRCODE custom de `fn_pago_registrar` a mensajes de UI.
 * Los codigos SQLSTATE son de 5 caracteres (`PAG0x`).
 *
 * | Código | Campo         | Significado                                                        |
 * |--------|---------------|-------------------------------------------------------------------|
 * | PAG01  | —             | La orden no existe o no admite pagos en su estado                |
 * | PAG02  | aplicaciones  | Comprobante ajeno a la orden / repetido / anulado / importe ≤ 0 o mayor al saldo |
 * | PAG03  | medios        | La suma de los medios no coincide con lo aplicado / sin medios   |
 * | PAG04  | medios        | La cuenta no está habilitada para el medio, o medio/cuenta inactivos |
 * | PAG05  | —             | El total del pago difiere del de la orden y no se confirmó       |
 * | PAG06  | medios        | Medio de tipo cheque sin los datos mínimos del cheque (número y banco) |
 */

/** @typedef {{ field: "aplicaciones" | "medios" | null, message: string, reload?: boolean }} ErrorUI */

const MAPA = {
  PAG01: {
    field: null,
    message: "La orden ya no admite pagos (puede haber cambiado de estado). Actualizá la página.",
    reload: true,
  },
  PAG02: {
    field: "aplicaciones",
    message:
      "Alguna aplicación no es válida: el comprobante no pertenece a la orden, está anulado o el importe supera su saldo.",
  },
  PAG03: {
    field: "medios",
    message: "La suma de los medios de pago debe coincidir con el total aplicado.",
  },
  PAG04: {
    field: "medios",
    message: "La cuenta elegida no está habilitada para ese medio de pago, o el medio o la cuenta están inactivos.",
    reload: true,
  },
  PAG05: {
    field: null,
    message:
      "El total del pago no coincide con el de la orden. Confirmá la diferencia para continuar.",
  },
  PAG06: {
    field: "medios",
    message:
      "Un medio de tipo cheque no tiene los datos mínimos del cheque: cargá al menos número y banco.",
  },
};

/**
 * @param {{ code?: string | null, error?: string | null } | null | undefined} result
 * @returns {ErrorUI}
 */
export function mapErrorPago(result) {
  const code = result?.code ?? null;

  if (code && MAPA[code]) {
    // PAG02 / PAG03 / PAG05 llevan los importes calculados en el mensaje de la función.
    if ((code === "PAG02" || code === "PAG03" || code === "PAG05") && result?.error) {
      return { ...MAPA[code], message: result.error };
    }
    return MAPA[code];
  }

  return {
    field: null,
    message: result?.error || "No se pudo registrar el pago.",
  };
}
