import { enviarEmail } from "./enviar";
import { escaparHtml } from "./plantilla";

const precioFmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

// Texto del mail por estado del pedido web (E-06). Los estados que no figuran no notifican.
const MENSAJES = {
  "Pendiente de pago": {
    asunto: (n) => `Recibimos tu pedido #${n}`,
    titulo: "Recibimos tu pedido",
    cuerpo: "Para confirmarlo, hacé la transferencia con los datos que viste al finalizar la compra.",
  },
  Pagado: {
    asunto: (n) => `Confirmamos el pago de tu pedido #${n}`,
    titulo: "Pago confirmado",
    cuerpo: "Ya acreditamos tu pago. Estamos preparando tu pedido.",
  },
  "Listo para retirar": {
    asunto: (n) => `Tu pedido #${n} está listo para retirar`,
    titulo: "Tu pedido está listo para retirar",
    cuerpo: "Ya podés pasar a retirarlo por la sucursal que elegiste. Llevá tu DNI y el número de pedido.",
  },
  Despachado: {
    asunto: (n) => `Tu pedido #${n} fue despachado`,
    titulo: "Tu pedido está en camino",
    cuerpo: "Despachamos tu pedido.",
  },
  Cancelado: {
    asunto: (n) => `Tu pedido #${n} fue cancelado`,
    titulo: "Pedido cancelado",
    cuerpo: "Cancelamos tu pedido. Si tenés dudas, comunicate con nosotros.",
  },
};

// Avisa al cliente el cambio de estado de su pedido (S5-8b). Nunca lanza: un fallo de mail no
// revierte el cambio de estado; el llamador puede ignorar el resultado.
export async function notificarEstadoPedido({ email, numero, estado, importeTotal }) {
  const msg = MENSAJES[estado];
  if (!msg || !email) return { ok: false, error: "Sin mensaje o destinatario" };
  const total = importeTotal != null ? ` Total: ${precioFmt.format(importeTotal)}.` : "";
  const detalle = `${msg.cuerpo}${total}`;
  return enviarEmail({
    para: email,
    asunto: msg.asunto(numero),
    titulo: msg.titulo,
    contenidoHtml: `<p>Pedido <strong>#${escaparHtml(numero)}</strong></p><p>${escaparHtml(detalle)}</p>`,
    texto: `Pedido #${numero}. ${detalle}`,
  });
}
