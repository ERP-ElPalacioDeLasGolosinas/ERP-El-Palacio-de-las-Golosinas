export const TIPOS_LISTA = ["Mayorista", "Minorista"];
export const ESTADOS_LISTA = ["Vigente", "Futura", "Vencida"];

const fechaFmt = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** Formatea una fecha `YYYY-MM-DD` (sin corrimiento de zona horaria). */
export function formatFechaLista(valor) {
  if (!valor) return "—";
  const d = new Date(`${String(valor).slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "—" : fechaFmt.format(d);
}

/** Fecha local de hoy como `YYYY-MM-DD`. */
export function hoyISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

const BADGE_ESTADO = {
  Vigente: "palacio-badge-activo",
  Futura:
    "inline-flex rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700",
  Vencida: "palacio-badge-inactivo",
};

export function badgeEstadoLista(estado) {
  return BADGE_ESTADO[estado] ?? "palacio-badge-inactivo";
}

export const BADGE_POR_VENCER =
  "inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800";
