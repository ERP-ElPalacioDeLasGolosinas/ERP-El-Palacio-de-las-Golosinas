/**
 * Estados de la sesión de caja (`sesion_caja.estado`).
 *
 * @typedef {"Pendiente" | "Abierta" | "Cierre solicitado" | "Cerrada" | "Rechazada"} EstadoSesionCaja
 */

const BADGE = {
  Pendiente: "palacio-badge-lleno",
  Abierta: "palacio-badge-activo",
  "Cierre solicitado": "palacio-badge-disponible",
};

/** @param {string | null | undefined} estado Sin estado = caja libre. */
export function badgeSesionCaja(estado) {
  return BADGE[estado] ?? "palacio-badge-inactivo";
}

/** @param {string | null | undefined} estado */
export function etiquetaSesionCaja(estado) {
  if (!estado) return "Libre";
  if (estado === "Pendiente") return "Pendiente de apertura";
  if (estado === "Abierta") return "Ocupada";
  return estado;
}

/** @param {{ numero: number, nombre?: string | null }} caja */
export function nombreCaja(caja) {
  return caja.nombre ? `Caja ${caja.numero} · ${caja.nombre}` : `Caja ${caja.numero}`;
}
