import { enviarEmail } from "./enviar";
import { escaparHtml } from "./plantilla";

// Avisa al cliente que el personal respondió su ticket de soporte (S5-17s). Nunca lanza: un fallo
// de mail no revierte la respuesta; el llamador puede ignorar el resultado.
export async function notificarRespuestaTicket({ email, asunto, mensaje }) {
  if (!email) return { ok: false, error: "Sin destinatario" };
  return enviarEmail({
    para: email,
    asunto: `Respondimos tu consulta: ${asunto}`,
    titulo: "Respondimos tu consulta",
    contenidoHtml: `<p>Sobre tu consulta <strong>${escaparHtml(asunto)}</strong>:</p><p>${escaparHtml(mensaje)}</p><p>Podés responder desde Mi cuenta → Soporte.</p>`,
    texto: `Respondimos tu consulta "${asunto}": ${mensaje}. Podés responder desde Mi cuenta → Soporte.`,
  });
}
