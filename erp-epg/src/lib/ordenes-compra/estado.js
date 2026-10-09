/** @typedef {'Pendiente' | 'Facturada' | 'Recibida parcial' | 'Recibida total' | 'Cancelada'} EstadoOrden */

export const ESTADOS_ORDEN = [
  "Pendiente",
  "Facturada",
  "Recibida parcial",
  "Recibida total",
  "Cancelada",
];

/** @param {string | null | undefined} estado */
export function badgeEstadoOrden(estado) {
  if (estado === "Recibida total") return "palacio-badge-activo";
  if (estado === "Facturada" || estado === "Recibida parcial") return "palacio-badge-disponible";
  if (estado === "Cancelada") return "palacio-badge-inactivo";
  return "palacio-badge-lleno";
}
