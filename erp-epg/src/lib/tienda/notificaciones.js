/** Texto del aviso al cliente web según el estado al que pasó su pedido. */
const TEXTO_ESTADO = {
  Pagado: "Recibimos el pago de tu pedido.",
  "En preparación": "Estamos preparando tu pedido.",
  "Listo para retirar": "Tu pedido está listo para retirar en la sucursal.",
  Despachado: "Tu pedido fue despachado.",
  Retirado: "Retiraste tu pedido. ¡Gracias por tu compra!",
  Cancelado: "Tu pedido fue cancelado.",
};

/**
 * @param {string} estado
 * @returns {string}
 */
export function textoNotificacion(estado) {
  return TEXTO_ESTADO[estado] ?? `Tu pedido pasó a "${estado}".`;
}
