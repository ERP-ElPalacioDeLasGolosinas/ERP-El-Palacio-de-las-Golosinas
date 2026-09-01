/**
 * Mapeo de los ERRCODE custom de `fn_movimiento_stock_registrar`,
 * `fn_movimiento_stock_transferir` y `fn_movimiento_stock_registrar_lote` a
 * mensajes y campos de UI.
 *
 * | Código        | Campo               | Significado                                          |
 * |---------------|---------------------|-------------------------------------------------------|
 * | MOV01         | cantidad            | Cantidad <= 0                                          |
 * | MOV02         | id_tipo_movimiento  | Tipo de movimiento inexistente/inhabilitado            |
 * | MOV03         | id_producto         | Producto inexistente/inhabilitado                      |
 * | MOV04         | id_deposito         | Depósito inexistente/inhabilitado                      |
 * | MOV05         | cantidad            | Stock insuficiente                                     |
 * | MOV06         | id_deposito_destino | Depósito lleno (no admite más ingresos)                |
 * | MOV07         | id_movimiento_referencia | El movimiento a corregir no existe               |
 * | MTR01         | id_deposito_destino | Origen y destino de la transferencia son el mismo      |
 * | MTR02 / MTR03 | —                   | No se encontró el tipo de movimiento de transferencia  |
 * | MLT01         | —                   | El lote no tiene ítems para registrar                  |
 * | LOT01         | —                   | Ingreso por compra sin productos                       |
 * | LOT02         | id_producto         | Un producto del ingreso ya no existe                   |
 * | LOT06         | —                   | Falta el tipo de movimiento "ingreso por compra"       |
 * | LOT07         | —                   | La compra asociada no existe                           |
 * | LOT08         | —                   | La compra ya tiene stock aplicado                      |
 * | LOT09         | —                   | La compra no está en estado válido para recepción      |
 * | LOT10         | —                   | El proveedor seleccionado no existe                    |
 */

/** @typedef {{ field: string | null, message: string, reload?: boolean }} ErrorUI */

const MAPA = {
  MOV01: { field: "cantidad", message: "La cantidad debe ser mayor a cero." },
  MOV02: {
    field: "id_tipo_movimiento",
    message: "El tipo de movimiento seleccionado no está disponible.",
  },
  MOV03: {
    field: "id_producto",
    message: "El producto seleccionado no está disponible.",
  },
  MOV04: {
    field: "id_deposito",
    message: "El depósito seleccionado no está disponible.",
  },
  MOV05: { field: "cantidad", message: "Stock insuficiente para este movimiento." },
  MOV06: {
    field: "id_deposito_destino",
    message: "El depósito está lleno, no se puede ingresar más stock.",
  },
  MOV07: {
    field: null,
    message: "El movimiento que intentás corregir no existe.",
  },
  MTR01: {
    field: "id_deposito_destino",
    message: "El depósito de origen y el de destino no pueden ser el mismo.",
  },
  MTR02: {
    field: null,
    message:
      "No se encontró el tipo de movimiento de transferencia. Contactá al administrador.",
  },
  MTR03: {
    field: null,
    message:
      "No se encontró el tipo de movimiento de transferencia. Contactá al administrador.",
  },
  MLT01: {
    field: null,
    message: "Debés cargar al menos un movimiento antes de registrar.",
  },
  LOT01: {
    field: null,
    message: "Cargá al menos un producto antes de registrar el ingreso.",
  },
  LOT02: {
    field: "id_producto",
    message: "Uno de los productos seleccionados ya no existe.",
  },
  LOT06: {
    field: null,
    message:
      "No se encontró el tipo de movimiento requerido. Contactá al administrador.",
  },
  LOT07: {
    field: null,
    message: "La compra seleccionada no existe.",
  },
  LOT08: {
    field: null,
    message: "Esa compra ya tiene stock aplicado.",
  },
  LOT09: {
    field: null,
    message: "La compra no está en un estado válido para recibir mercadería.",
  },
  LOT10: {
    field: null,
    message: "El proveedor seleccionado no existe.",
  },
};

/**
 * @param {{ code?: string | null, error?: string | null } | null | undefined} result
 * @returns {ErrorUI}
 */
export function mapErrorMovimiento(result) {
  const code = result?.code ?? null;

  if (code && MAPA[code]) {
    return MAPA[code];
  }

  return {
    field: null,
    message: result?.error || "No se pudo completar la operación.",
  };
}
