import { plantillaBase } from "./plantilla";

const RESEND_URL = "https://api.resend.com/emails";

// Envía un mail por Resend (API REST, sin dependencias). Nunca lanza: devuelve { ok, error }
// para que un fallo de mail no revierta la operación que lo disparó (S5-8b).
// Requiere RESEND_API_KEY y EMAIL_FROM (ej. "El Palacio de las Golosinas <tienda@dominio.com>").
export async function enviarEmail({ para, asunto, titulo, contenidoHtml, texto }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return { ok: false, error: "Email no configurado" };
  if (!para || !asunto) return { ok: false, error: "Faltan destinatario o asunto" };

  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: Array.isArray(para) ? para : [para],
        subject: asunto,
        html: plantillaBase({ titulo: titulo ?? asunto, contenidoHtml: contenidoHtml ?? "" }),
        ...(texto ? { text: texto } : {}),
      }),
    });
    if (!res.ok) {
      const detalle = await res.text().catch(() => "");
      console.error("enviarEmail: Resend respondió", res.status, detalle);
      return { ok: false, error: `Resend ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error("enviarEmail:", e);
    return { ok: false, error: "No se pudo enviar el email" };
  }
}
