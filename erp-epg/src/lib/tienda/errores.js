// Mensajes de fn_cliente_web_registrar (errcodes CLW01…CLW07, S5-1b).
const MENSAJES = {
  CLW01: "El nombre no puede estar vacío.",
  CLW02: "El documento debe ser un DNI (7 u 8 dígitos) o un CUIT con formato XX-XXXXXXXX-X.",
  CLW03: "El teléfono debe tener entre 6 y 15 dígitos, sin espacios ni guiones.",
  CLW04: "Esta cuenta no puede registrarse como cliente.",
  CLW05: "Ya existe un cliente con ese documento.",
  CLW06: "El mail de la cuenta no es válido para registrarse.",
  CLW07: "La tienda no está disponible por el momento. Probá más tarde.",
  CLW08: "Primero tenés que crear tu cuenta de cliente.",
};

export function mensajeErrorRegistro(error) {
  return MENSAJES[error?.code] ?? "No se pudo completar el registro.";
}

// Mensajes de fn_pedido_web_registrar (errcodes PWB01…PWB04, S5-5b) y fn_tienda_carrito_validar.
const MENSAJES_PEDIDO = {
  PWB01: "Tenés que iniciar sesión con tu cuenta de cliente para comprar.",
  PWB02: "Ese medio de pago no está disponible por el momento.",
  PWB03: "Tu carrito está vacío.",
  PWB04: "Hay artículos sin stock o que ya no están disponibles. Revisá tu carrito.",
  PWB11: "Completá tu DNI/CUIT y teléfono para finalizar el pedido.",
  CAR01: "Tu carrito tiene datos inválidos. Revisalo.",
  CAR02: "Tu carrito tiene demasiados artículos.",
};

export function mensajeErrorPedido(error) {
  return MENSAJES_PEDIDO[error?.code] ?? "No se pudo registrar el pedido. Probá de nuevo en un rato.";
}
