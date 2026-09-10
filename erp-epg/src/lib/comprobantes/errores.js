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
 */

/** @typedef {{ field: "id_proveedor" | "id_tipo_comprobante" | "numero" | "importe" | "fechas" | "detalle" | null, message: string, reload?: boolean }} ErrorUI */

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
