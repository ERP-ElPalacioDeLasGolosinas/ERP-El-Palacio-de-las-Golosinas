/**
 * Mapeo de los ERRCODE custom de las funciones `fn_proveedor_*` a mensajes de UI.
 *
 * | Código | Campo     | Significado                                      |
 * |--------|-----------|--------------------------------------------------|
 * | PRV01  | nombre    | Nombre vacío                                     |
 * | PRV02  | cuit      | CUIT vacío o formato inválido                    |
 * | PRV03  | mail      | Mail vacío o formato inválido                    |
 * | PRV04  | cuit      | CUIT duplicado                                   |
 * | PRV05  | —         | El proveedor ya no existe (recargar tabla)       |
 * | PRV06  | rs        | Razón social no informada                        |
 * | PRV07  | telefono  | Teléfono vacío o fuera de rango                  |
 * | PRV08  | —         | Tiene compras/lotes asociados (no se elimina)    |
 * | PRV09  | mail      | Mail duplicado                                   |
 */

/** @typedef {{
 *   field: "nombre" | "rs" | "cuit" | "telefono" | "mail" | null,
 *   message: string,
 *   reload?: boolean,
 * }} ErrorUI */

const MAPA = {
  PRV01: { field: "nombre", message: "El nombre es obligatorio." },
  PRV02: {
    field: "cuit",
    message: "El CUIT debe tener el formato XX-XXXXXXXX-X.",
  },
  PRV03: {
    field: "mail",
    message: "Ingresá un correo electrónico válido.",
  },
  PRV04: {
    field: "cuit",
    message: "Ya existe un proveedor con ese CUIT.",
  },
  PRV05: {
    field: null,
    message:
      "El proveedor ya no existe (puede haber sido eliminado por otro usuario).",
    reload: true,
  },
  PRV06: {
    field: "rs",
    message: "Elegí una razón social.",
  },
  PRV07: {
    field: "telefono",
    message: "El teléfono debe tener entre 6 y 15 dígitos.",
  },
  PRV09: {
    field: "mail",
    message: "Ya existe un proveedor con ese correo.",
  },
};

/**
 * @param {{ code?: string | null, error?: string | null } | null | undefined} result
 * @returns {ErrorUI}
 */
export function mapErrorProveedor(result) {
  const code = result?.code ?? null;

  if (code && MAPA[code]) {
    return MAPA[code];
  }

  // PRV08 y cualquier otro: el mensaje del RPC ya viene en español.
  return {
    field: null,
    message: result?.error || "No se pudo completar la operación.",
  };
}
