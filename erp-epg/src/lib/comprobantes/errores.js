/**
 * Mapeo de los ERRCODE custom de las funciones `fn_comprobante_*` a mensajes de UI.
 *
 * | Código | Campo        | Significado                                                  |
 * |--------|--------------|-------------------------------------------------------------|
 * | CMP01  | id_proveedor | Proveedor inexistente                                       |
 * | CMP02  | id_tipo      | Tipo inválido o que no aplica a compras                     |
 * | CMP03  | numero       | Punto de venta / número inválido                            |
 * | CMP04  | numero       | Duplicado proveedor + tipo + punto de venta + número        |
 * | CMP05  | importe      | Importe total ≤ 0                                           |
 * | CMP06  | fechas       | Fechas inválidas (vencimiento anterior al comprobante)      |
 * | CMP07  | detalle      | Detalle vacío o con líneas inválidas                        |
 * | CMP08  | —            | Comprobante inexistente (recargar)                          |
 * | CMP09  | id_proveedor | Proveedor inactivo                                          |
 *
 * Notas de débito (`fn_nota_debito_registrar`, S2-7):
 *
 * | Código | Campo                   | Significado                                     |
 * |--------|-------------------------|------------------------------------------------|
 * | NDB01  | id_proveedor            | Proveedor inexistente (recargar)               |
 * | NDB02  | id_proveedor            | Proveedor inactivo                             |
 * | NDB03  | id_tipo_comprobante     | Tipo inválido o que no aplica a compras        |
 * | NDB04  | id_tipo_comprobante     | El tipo no es una nota de débito               |
 * | NDB05  | numero                  | Punto de venta / número inválido               |
 * | NDB06  | fechas                  | Fecha del comprobante obligatoria              |
 * | NDB07  | motivo                  | Motivo inválido                                |
 * | NDB08  | id_comprobante_asociado | Comprobante asociado inválido                  |
 * | NDB09  | detalle                 | Detalle vacío o con líneas inválidas           |
 * | NDB10  | importe                 | Importe total ≤ 0                              |
 * | NDB11  | numero                  | Duplicado proveedor + tipo + punto + número    |
 *
 * Remitos (`fn_remito_registrar`, S2-7):
 *
 * | Código | Campo                   | Significado                                     |
 * |--------|-------------------------|------------------------------------------------|
 * | RMT01  | id_proveedor            | Proveedor inexistente (recargar)               |
 * | RMT02  | id_proveedor            | Proveedor inactivo                             |
 * | RMT03  | id_tipo_comprobante     | Tipo inválido o que no aplica a compras        |
 * | RMT04  | id_tipo_comprobante     | El tipo no es un remito                        |
 * | RMT05  | numero                  | Punto de venta / número inválido               |
 * | RMT06  | fechas                  | Fecha del comprobante obligatoria              |
 * | RMT07  | id_comprobante_asociado | Comprobante asociado inválido                  |
 * | RMT08  | detalle                 | Detalle vacío o con líneas inválidas           |
 * | RMT09  | numero                  | Duplicado proveedor + tipo + punto + número    |
 *
 * Notas de crédito (`fn_nota_credito_registrar`, S2-7):
 *
 * | Código | Campo                   | Significado                                     |
 * |--------|-------------------------|------------------------------------------------|
 * | NCR01  | id_proveedor            | Proveedor inexistente (recargar)               |
 * | NCR02  | id_proveedor            | Proveedor inactivo                             |
 * | NCR03  | id_tipo_comprobante     | Tipo inválido o que no aplica a compras        |
 * | NCR04  | id_tipo_comprobante     | El tipo no es una nota de crédito              |
 * | NCR05  | numero                  | Punto de venta / número inválido               |
 * | NCR06  | fechas                  | Fecha del comprobante obligatoria              |
 * | NCR07  | motivo                  | Motivo inválido                                |
 * | NCR08  | id_comprobante_asociado | Factura asociada inválida (falta / otro prov. / no es factura / anulada) |
 * | NCR09  | detalle                 | Detalle vacío o con líneas inválidas           |
 * | NCR10  | importe                 | Importe total ≤ 0 o mayor al total de la factura |
 * | NCR11  | numero                  | Duplicado proveedor + tipo + punto + número    |
 * | NCR12  | detalle                 | Línea de origen ajena a la factura o cantidad mayor a la de origen |
 */

/** @typedef {{ field: "id_proveedor" | "id_tipo_comprobante" | "numero" | "importe" | "fechas" | "detalle" | "id_comprobante_asociado" | "motivo" | null, message: string, reload?: boolean }} ErrorUI */

const MAPA = {
  CMP01: {
    field: "id_proveedor",
    message: "El proveedor seleccionado ya no existe.",
    reload: true,
  },
  CMP02: {
    field: "id_tipo_comprobante",
    message: "El tipo de comprobante no es válido o no aplica a compras.",
  },
  CMP03: {
    field: "numero",
    message: "El punto de venta y el número deben ser mayores a cero.",
  },
  CMP04: {
    field: "numero",
    message:
      "Ya existe un comprobante de ese proveedor, tipo, punto de venta y número.",
  },
  CMP05: {
    field: "importe",
    message: "El importe total debe ser mayor a cero.",
  },
  CMP06: {
    field: "fechas",
    message: "El vencimiento no puede ser anterior a la fecha del comprobante.",
  },
  CMP07: {
    field: "detalle",
    message:
      "Cada línea necesita artículo o concepto, cantidad mayor a cero y precio no negativo. Cargá al menos una línea.",
  },
  CMP08: {
    field: null,
    message:
      "El comprobante ya no existe (puede haber sido anulado por otro usuario).",
    reload: true,
  },
  CMP09: {
    field: "id_proveedor",
    message: "El proveedor está inactivo y no admite nuevos comprobantes.",
  },

  // Notas de débito (S2-7)
  NDB01: {
    field: "id_proveedor",
    message: "El proveedor seleccionado ya no existe.",
    reload: true,
  },
  NDB02: {
    field: "id_proveedor",
    message: "El proveedor está inactivo y no admite nuevos comprobantes.",
  },
  NDB03: {
    field: "id_tipo_comprobante",
    message: "El tipo de comprobante no es válido o no aplica a compras.",
  },
  NDB04: {
    field: "id_tipo_comprobante",
    message: "El tipo de comprobante seleccionado no es una nota de débito.",
  },
  NDB05: {
    field: "numero",
    message: "El punto de venta y el número deben ser mayores a cero.",
  },
  NDB06: {
    field: "fechas",
    message: "La fecha del comprobante es obligatoria.",
  },
  NDB07: {
    field: "motivo",
    message: "Elegí un motivo válido para la nota de débito.",
  },
  NDB08: {
    field: "id_comprobante_asociado",
    message:
      "La factura asociada no es válida (otro proveedor, anulada o inexistente).",
  },
  NDB09: {
    field: "detalle",
    message: "Cada línea necesita un concepto e importes no negativos.",
  },
  NDB10: {
    field: "importe",
    message: "El importe total de la nota de débito debe ser mayor a cero.",
  },
  NDB11: {
    field: "numero",
    message:
      "Ya existe un comprobante de ese proveedor, tipo, punto de venta y número.",
  },

  // Remitos (S2-7)
  RMT01: {
    field: "id_proveedor",
    message: "El proveedor seleccionado ya no existe.",
    reload: true,
  },
  RMT02: {
    field: "id_proveedor",
    message: "El proveedor está inactivo y no admite nuevos comprobantes.",
  },
  RMT03: {
    field: "id_tipo_comprobante",
    message: "El tipo de comprobante no es válido o no aplica a compras.",
  },
  RMT04: {
    field: "id_tipo_comprobante",
    message: "El tipo de comprobante seleccionado no es un remito.",
  },
  RMT05: {
    field: "numero",
    message: "El punto de venta y el número deben ser mayores a cero.",
  },
  RMT06: {
    field: "fechas",
    message: "La fecha del comprobante es obligatoria.",
  },
  RMT07: {
    field: "id_comprobante_asociado",
    message:
      "La factura asociada no es válida (otro proveedor, anulada o inexistente).",
  },
  RMT08: {
    field: "detalle",
    message: "Cada línea necesita un producto y una cantidad mayor a cero.",
  },
  RMT09: {
    field: "numero",
    message:
      "Ya existe un comprobante de ese proveedor, tipo, punto de venta y número.",
  },

  // Notas de crédito (S2-7)
  NCR01: {
    field: "id_proveedor",
    message: "El proveedor seleccionado ya no existe.",
    reload: true,
  },
  NCR02: {
    field: "id_proveedor",
    message: "El proveedor está inactivo y no admite nuevos comprobantes.",
  },
  NCR03: {
    field: "id_tipo_comprobante",
    message: "El tipo de comprobante no es válido o no aplica a compras.",
  },
  NCR04: {
    field: "id_tipo_comprobante",
    message: "El tipo de comprobante seleccionado no es una nota de crédito.",
  },
  NCR05: {
    field: "numero",
    message: "El punto de venta y el número deben ser mayores a cero.",
  },
  NCR06: {
    field: "fechas",
    message: "La fecha del comprobante es obligatoria.",
  },
  NCR07: {
    field: "motivo",
    message: "Elegí un motivo válido para la nota de crédito.",
  },
  NCR08: {
    field: "id_comprobante_asociado",
    message:
      "La factura asociada no es válida (falta, es de otro proveedor, no es una factura o está anulada).",
  },
  NCR09: {
    field: "detalle",
    message:
      "Hay líneas inválidas. En devolución cada línea necesita producto, cantidad y la línea de la factura; en el resto, concepto e importe.",
  },
  NCR10: {
    field: "importe",
    message:
      "El importe total de la nota de crédito debe ser mayor a cero y no puede superar el total de la factura asociada.",
  },
  NCR11: {
    field: "numero",
    message:
      "Ya existe un comprobante de ese proveedor, tipo, punto de venta y número.",
  },
  NCR12: {
    field: "detalle",
    message:
      "Alguna línea no corresponde a la factura asociada o la cantidad a acreditar supera la de origen.",
  },
};

/**
 * @param {{ code?: string | null, error?: string | null } | null | undefined} result
 * @returns {ErrorUI}
 */
export function mapErrorComprobante(result) {
  const code = result?.code ?? null;

  if (code && MAPA[code]) {
    return MAPA[code];
  }

  return {
    field: null,
    message: result?.error || "No se pudo completar la operación.",
  };
}
