/**
 * Mapeo de los ERRCODE custom de las funciones `fn_orden_pago_*` a mensajes de UI.
 * Los codigos SQLSTATE son de 5 caracteres (`OPG0x`); en el plan figuran como
 * `OP0x`.
 *
 * | Código | Campo         | Significado                                                    |
 * |--------|---------------|---------------------------------------------------------------|
 * | OPG01  | proveedor     | Proveedor inexistente o inactivo                              |
 * | OPG02  | comprobantes  | Comprobantes de distinto proveedor                            |
 * | OPG03  | comprobantes  | Comprobante inexistente / anulado / sin saldo / repetido / vacío |
 * | OPG04  | comprobantes  | Importe imputado ≤ 0 o mayor al saldo del comprobante         |
 * | OPG05  | medios        | La suma de los medios no coincide con lo imputado / sin medios |
 * | OPG06  | medios        | La cuenta no está habilitada para el medio de pago            |
 * | OPG07  | medios        | Medio o cuenta inexistente / inactivo                         |
 * | OPG08  | —             | La orden ya no existe (recargar)                              |
 * | OPG09  | —             | La orden no admite esa acción por su estado                   |
 */

/** @typedef {{ field: "proveedor" | "comprobantes" | "medios" | null, message: string, reload?: boolean }} ErrorUI */

const MAPA = {
  OPG01: {
    field: "proveedor",
    message: "El proveedor no es válido o está inactivo.",
  },
  OPG02: {
    field: "comprobantes",
    message: "Todos los comprobantes de la orden deben ser del mismo proveedor.",
  },
  OPG03: {
    field: "comprobantes",
    message:
      "Alguno de los comprobantes ya no tiene saldo, está anulado o está repetido. Actualizá la lista.",
  },
  OPG04: {
    field: "comprobantes",
    message: "No podés imputar más que el saldo pendiente de cada comprobante.",
  },
  OPG05: {
    field: "medios",
    message: "La suma de los medios de pago debe coincidir con el total imputado.",
  },
  OPG06: {
    field: "medios",
    message: "La cuenta elegida no está habilitada para ese medio de pago.",
  },
  OPG07: {
    field: "medios",
    message: "Un medio de pago o una cuenta ya no existe o está inactivo. Actualizá la lista.",
    reload: true,
  },
  OPG08: {
    field: null,
    message: "La orden de pago ya no existe (puede haberla cambiado otro usuario).",
    reload: true,
  },
  OPG09: {
    field: null,
    message: "La orden no admite esta acción en su estado actual.",
    reload: true,
  },
};

/**
 * @param {{ code?: string | null, error?: string | null } | null | undefined} result
 * @returns {ErrorUI}
 */
export function mapErrorOrdenPago(result) {
  const code = result?.code ?? null;

  if (code && MAPA[code]) {
    // OPG04 / OPG05 llevan los importes calculados en el mensaje de la función.
    if ((code === "OPG04" || code === "OPG05") && result?.error) {
      return { ...MAPA[code], message: result.error };
    }
    return MAPA[code];
  }

  return {
    field: null,
    message: result?.error || "No se pudo completar la operación.",
  };
}
