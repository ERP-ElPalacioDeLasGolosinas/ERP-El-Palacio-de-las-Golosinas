/**
 * Mapeo de los ERRCODE custom de las funciones `fn_cliente_*` a mensajes de UI.
 *
 * | Código | Campo     | Significado                                           |
 * |--------|-----------|-------------------------------------------------------|
 * | CLI01  | nombre    | Nombre vacío                                          |
 * | CLI02  | tipo      | Tipo faltante / inexistente / inhabilitado            |
 * | CLI03  | documento | Documento vacío o formato inválido                    |
 * | CLI04  | telefono  | Teléfono vacío o inválido                             |
 * | CLI05  | mail      | Mail con formato inválido                             |
 * | CLI06  | documento | Documento ya registrado                               |
 * | CLI07  | —         | Cliente no encontrado (recargar tabla)                |
 * | CLI08  | —         | Intento de modificar/inhabilitar Consumidor Final     |
 */

/** @typedef {{
 *   field: "nombre" | "tipo" | "documento" | "telefono" | "mail" | null,
 *   message: string,
 *   reload?: boolean,
 * }} ErrorUI */

const MAPA = {
  CLI01: { field: "nombre", message: "El nombre es obligatorio." },
  CLI02: {
    field: "tipo",
    message: "Elegí un tipo de cliente activo.",
  },
  CLI03: {
    field: "documento",
    message: "Ingresá un DNI (7 u 8 dígitos) o un CUIT XX-XXXXXXXX-X.",
  },
  CLI04: {
    field: "telefono",
    message: "El teléfono debe tener entre 6 y 15 dígitos.",
  },
  CLI05: {
    field: "mail",
    message: "Ingresá un correo electrónico válido.",
  },
  CLI06: {
    field: "documento",
    message: "Ya existe un cliente con ese documento.",
  },
  CLI07: {
    field: null,
    message:
      "El cliente ya no existe (puede haber sido eliminado por otro usuario).",
    reload: true,
  },
  CLI08: {
    field: null,
    message: "El cliente Consumidor Final no se puede modificar ni inhabilitar.",
  },
};

/**
 * @param {{ code?: string | null, error?: string | null } | null | undefined} result
 * @returns {ErrorUI}
 */
export function mapErrorCliente(result) {
  const code = result?.code ?? null;

  if (code && MAPA[code]) {
    return MAPA[code];
  }

  return {
    field: null,
    message: result?.error || "No se pudo completar la operación.",
  };
}
