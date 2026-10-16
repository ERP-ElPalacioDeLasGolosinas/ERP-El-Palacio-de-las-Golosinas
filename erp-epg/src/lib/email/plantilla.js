const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

// Escapa texto de usuario antes de meterlo en `contenidoHtml`.
export function escaparHtml(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

// Plantilla base de los mails de la tienda. `contenidoHtml` ya debe venir escapado.
export function plantillaBase({ titulo, contenidoHtml }) {
  return `<!doctype html>
<html lang="es">
<body style="margin:0;padding:24px;background:#f6f4f1;font-family:Arial,Helvetica,sans-serif;color:#2b2b2b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;">
    <tr><td style="padding:20px 24px;border-bottom:1px solid #eee;font-size:18px;font-weight:bold;">El Palacio de las Golosinas</td></tr>
    <tr><td style="padding:24px;">
      <h1 style="margin:0 0 16px;font-size:20px;">${escaparHtml(titulo)}</h1>
      <div style="font-size:15px;line-height:1.5;">${contenidoHtml}</div>
    </td></tr>
    <tr><td style="padding:16px 24px;border-top:1px solid #eee;font-size:12px;color:#888;">Este mensaje se envió automáticamente, no respondas a este mail.</td></tr>
  </table>
</body>
</html>`;
}
