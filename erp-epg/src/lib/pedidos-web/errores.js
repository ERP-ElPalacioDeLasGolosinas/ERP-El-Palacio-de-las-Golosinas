import { mapErrorCobro } from "@/lib/cobros/errores";

/**
 * Mapeo de los ERRCODE de `fn_pedido_web_cambiar_estado` / `fn_pedido_web_confirmar_pago`
 * a mensajes de UI.
 *
 * | Código | Significado                                                              |
 * |--------|--------------------------------------------------------------------------|
 * | PWB05  | El pedido no existe                                                      |
 * | PWB06  | Stock insuficiente al confirmar el pago (el mensaje trae los artículos)  |
 * | PWB07  | Tesorería no configuró la cuenta receptora de la tienda                  |
 * | PWB08  | Falta configuración (factura, lista o tipo de movimiento)                |
 * | PWB09  | Solo el personal del ERP puede cambiar el estado                         |
 * | PWB10  | Transición de estado no permitida                                        |
 * | COB0x  | Errores del cobro (ver `lib/cobros/errores.js`)                          |
 */
const CON_MENSAJE_DE_BASE = new Set(["PWB06", "PWB08", "PWB10"]);

const MAPA = {
  PWB05: "El pedido no existe o ya no admite ese cambio. Actualizá la página.",
  PWB07: "Tesorería todavía no configuró la cuenta que recibe las transferencias de la tienda.",
  PWB09: "Solo el personal del ERP puede cambiar el estado de un pedido.",
};

/**
 * @param {{ code?: string | null, error?: string | null } | null | undefined} result
 * @returns {string}
 */
export function mensajeErrorPedidoWeb(result) {
  const code = result?.code ?? null;
  if (code && CON_MENSAJE_DE_BASE.has(code) && result?.error) return result.error;
  if (code && MAPA[code]) return MAPA[code];
  if (code?.startsWith("COB")) return mapErrorCobro(result).message;
  return result?.error || "No se pudo cambiar el estado del pedido.";
}
