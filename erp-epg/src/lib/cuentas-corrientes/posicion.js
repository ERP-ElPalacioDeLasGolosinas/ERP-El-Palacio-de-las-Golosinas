/**
 * Posición de la cuenta desde la empresa.
 * Proveedor: saldo > 0 le debemos (en contra). Saldo < 0 es a nuestro favor.
 * Cliente: saldo > 0 nos debe (a favor).
 *
 * @param {"proveedor" | "cliente"} lado
 * @param {number | string | null | undefined} saldo
 */
export function posicionCuenta(lado, saldo) {
  const n = Number(saldo) || 0;
  if (Math.abs(n) < 0.005) {
    return {
      clave: "aldia",
      label: "Al día",
      detalle: "Sin saldo",
      badge: "palacio-badge-inactivo",
    };
  }
  if (lado === "proveedor") {
    return n > 0
      ? {
          clave: "contra",
          label: "En contra",
          detalle: "Le debemos",
          badge: "palacio-badge-en-contra",
        }
      : {
          clave: "favor",
          label: "A favor",
          detalle: "Saldo a nuestro favor",
          badge: "palacio-badge-activo",
        };
  }
  return n > 0
    ? {
        clave: "favor",
        label: "A favor",
        detalle: "Nos debe",
        badge: "palacio-badge-activo",
      }
    : {
        clave: "contra",
        label: "En contra",
        detalle: "Saldo a favor del cliente",
        badge: "palacio-badge-en-contra",
      };
}
