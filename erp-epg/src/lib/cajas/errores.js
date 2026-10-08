/**
 * Mapeo de los ERRCODE custom de `fn_caja_*` a mensajes de UI.
 *
 * | Código | Campo   | Significado                                                |
 * |--------|---------|------------------------------------------------------------|
 * | CAJ01  | —       | (sin uso) una sucursal puede tener varias cajas abiertas    |
 * | CAJ02  | monto   | Monto inicial vacío o negativo                             |
 * | CAJ03  | —       | La caja no existe                                          |
 * | CAJ04  | —       | La caja está cerrada / no hay caja abierta                 |
 * | CAJ05  | importe | Tipo, importe o motivo del movimiento inválido             |
 * | CAJ06  | medio   | Medio inexistente, inactivo o cheque propio                |
 * | CAJ07  | medio   | El medio requiere referencia                               |
 * | CAJ08  | importe | Egreso mayor al saldo disponible del medio                 |
 * | CAJ09  | medios  | Medios de cobro vacíos o suma distinta del total           |
 * | CAJ10  | —       | La venta no se puede cobrar en caja                        |
 * | CAJ11  | monto   | Efectivo contado inválido                                  |
 * | CAJ12  | —       | Cierre sin arqueo posterior al último movimiento           |
 * | CAJ13  | —       | Movimientos y arqueos inmutables                           |
 * | CAJ14  | deposito| Depósito inválido, o la caja ya tiene uno                  |
 * | CAJ15  | medios  | Transferencia/cheque sin cuenta, o la cuenta no corresponde |
 */

/** @typedef {{ field: "monto" | "importe" | "medio" | "medios" | "deposito" | null, message: string, reload?: boolean }} ErrorUI */

const MAPA = {
  CAJ01: { field: null, message: "Ya hay una caja abierta en el punto de venta.", reload: true },
  CAJ02: { field: "monto", message: "El monto inicial es obligatorio y no puede ser negativo." },
  CAJ03: { field: null, message: "La caja no existe.", reload: true },
  CAJ04: { field: null, message: "La caja está cerrada. Actualizá la página.", reload: true },
  CAJ05: { field: "importe", message: "Revisá el tipo, el importe y el motivo del movimiento." },
  CAJ06: { field: "medio", message: "El medio de pago no existe, está inactivo o no se admite en caja.", reload: true },
  CAJ07: { field: "medio", message: "El medio de pago requiere una referencia." },
  CAJ08: { field: "importe", message: "El egreso supera el saldo disponible de ese medio." },
  CAJ09: { field: "medios", message: "La suma de los medios tiene que ser igual al total de la venta." },
  CAJ10: { field: null, message: "La venta no se puede cobrar en caja.", reload: true },
  CAJ11: { field: "monto", message: "Ingresá el efectivo contado (cero o más)." },
  CAJ12: { field: null, message: "Antes de cerrar la caja tenés que realizar el arqueo." },
  CAJ13: { field: null, message: "Los movimientos y arqueos de caja no se pueden modificar." },
  CAJ14: { field: "deposito", message: "Elegí un depósito activo. La caja vende el stock de esa sucursal." },
  CAJ15: { field: "medios", message: "Elegí la cuenta de tesorería en la que se acredita el medio." },
};

const CON_MENSAJE_DE_BASE = new Set(["CAJ01", "CAJ04", "CAJ06", "CAJ07", "CAJ08", "CAJ09", "CAJ12", "CAJ14", "CAJ15"]);

/**
 * @param {{ code?: string | null, error?: string | null } | null | undefined} result
 * @returns {ErrorUI}
 */
export function mapErrorCaja(result) {
  const code = result?.code ?? null;

  if (code && MAPA[code]) {
    if (CON_MENSAJE_DE_BASE.has(code) && result?.error) {
      return { ...MAPA[code], message: result.error };
    }
    return MAPA[code];
  }

  return {
    field: null,
    message: result?.error || "No se pudo completar la operación de caja.",
  };
}
