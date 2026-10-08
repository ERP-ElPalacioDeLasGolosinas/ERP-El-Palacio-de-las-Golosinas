/** @typedef {{ field: string | null, message: string }} ErrorUI */

const MAPA = {
  OCO01: { field: "id_proveedor", message: "El proveedor seleccionado no existe." },
  OCO02: { field: "id_proveedor", message: "El proveedor está inactivo." },
  OCO03: { field: "fecha_emision", message: "La fecha de emisión es obligatoria." },
  OCO04: {
    field: "detalle",
    message: "Cada renglón necesita un artículo y una cantidad mayor a cero.",
  },
  OCO05: {
    field: "detalle",
    message: "Un artículo no puede repetirse. Editá la cantidad del renglón.",
  },
  OCO06: { field: "detalle", message: "Hay un artículo inexistente o inactivo." },
  OCO07: { field: null, message: "La orden de compra no existe." },
  OCO08: {
    field: null,
    message:
      "Solo se puede cancelar una orden pendiente, antes de recibir mercadería o cargar facturas.",
  },
  OCO09: {
    field: null,
    message: "La orden de compra está cancelada y no admite esta operación.",
  },
};

/**
 * @param {{ code?: string | null, error?: string | null } | null | undefined} result
 * @returns {ErrorUI}
 */
export function mapErrorOrden(result) {
  const code = result?.code ?? null;
  if (code && MAPA[code]) return MAPA[code];
  return {
    field: null,
    message: result?.error || "No se pudo registrar la orden de compra.",
  };
}
