/**
 * Clases de documento de un tipo de comprobante de proveedor (D-022).
 * Fuente de verdad: CHECK `tipo_comprobante_clase_check` en la base.
 */

/** @typedef {"factura" | "nota_credito" | "nota_debito" | "remito"} ClaseComprobante */

/** @type {Array<{ value: ClaseComprobante, label: string }>} */
export const CLASES_COMPROBANTE = [
  { value: "factura", label: "Factura" },
  { value: "nota_credito", label: "Nota de crédito" },
  { value: "nota_debito", label: "Nota de débito" },
  { value: "remito", label: "Remito" },
];

/**
 * @param {string | null | undefined} clase
 * @returns {string}
 */
export function claseComprobanteLabel(clase) {
  return CLASES_COMPROBANTE.find((c) => c.value === clase)?.label ?? clase ?? "—";
}
