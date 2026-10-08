const monedaFmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

const fechaHoraFmt = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const horaFmt = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
});

/** @param {unknown} valor */
export function moneda(valor) {
  return monedaFmt.format(Number(valor) || 0);
}

/** @param {string | null | undefined} valor */
export function fechaHora(valor) {
  if (!valor) return "—";
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? "—" : fechaHoraFmt.format(d);
}

/** @param {string | null | undefined} valor */
export function hora(valor) {
  if (!valor) return "—";
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? "—" : horaFmt.format(d);
}

export const redondear = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Saldo disponible de un medio en la caja: para efectivo es el saldo teórico
 * (incluye el monto inicial); para el resto, ingresos − egresos del medio.
 *
 * @param {Record<string, any> | null | undefined} resumen
 * @param {{ id_medio_pago: string, tipo: string } | null | undefined} medio
 */
export function saldoDisponible(resumen, medio) {
  if (!resumen || !medio) return 0;
  if (medio.tipo === "Efectivo") return Number(resumen.efectivo?.saldo_teorico) || 0;
  const fila = (resumen.medios ?? []).find((m) => m.id_medio_pago === medio.id_medio_pago);
  return Number(fila?.saldo) || 0;
}
