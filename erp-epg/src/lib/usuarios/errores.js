/**
 * Mapeo de los ERRCODE custom de las funciones `fn_usuario_*` (y de la edge function
 * `crear-usuario`) a mensajes de UI.
 *
 * | Código | Campo     | Significado                                      |
 * |--------|-----------|--------------------------------------------------|
 * | USR01  | —         | Solo el gerente gestiona usuarios                |
 * | USR02  | nombre    | Nombre o apellido vacío                          |
 * | USR03  | dni       | DNI fuera de rango (7 u 8 dígitos)               |
 * | USR04  | dni       | DNI duplicado                                    |
 * | USR05  | —         | El usuario ya no existe (recargar tabla)         |
 * | USR06  | —         | No es un empleado gestionable (es gerente)       |
 * | USR07  | rol       | Rol inválido                                     |
 * | USR08  | fecha     | Fecha de nacimiento inválida (menor de 16)       |
 * | USR09  | telefono  | Teléfono vacío o fuera de rango                  |
 * | USR10  | —         | Tiene una caja en curso                          |
 * | USR11  | —         | Tiene operaciones registradas (no se elimina)    |
 * | MAIL   | mail      | Mail ya registrado (alta, edge function)         |
 */

/** @typedef {{
 *   field: "nombre" | "apellido" | "dni" | "fecha" | "telefono" | "rol" | "mail" | "password" | null,
 *   message: string,
 *   reload?: boolean,
 * }} ErrorUI */

const MAPA = {
  USR02: { field: "nombre", message: "El nombre y el apellido son obligatorios." },
  USR03: { field: "dni", message: "El DNI debe tener entre 7 y 8 dígitos." },
  USR04: { field: "dni", message: "Ya existe otro usuario con ese DNI." },
  USR05: {
    field: null,
    message: "El usuario ya no existe (puede haber sido eliminado por otro gerente).",
    reload: true,
  },
  USR07: { field: "rol", message: "Elegí un rol: depósito, compras o ventas." },
  USR08: {
    field: "fecha",
    message: "La fecha de nacimiento no es válida (al menos 16 años).",
  },
  USR09: { field: "telefono", message: "El teléfono debe tener entre 6 y 15 dígitos." },
  MAIL: { field: "mail", message: "Ya existe una cuenta con ese correo." },
};

/**
 * @param {{ code?: string | null, error?: string | null } | null | undefined} result
 * @returns {ErrorUI}
 */
export function mapErrorUsuario(result) {
  const code = result?.code ?? null;

  if (code && MAPA[code]) {
    return MAPA[code];
  }

  // USR01, USR06, USR10, USR11 y cualquier otro: el mensaje del RPC ya viene en español.
  return {
    field: null,
    message: result?.error || "No se pudo completar la operación.",
  };
}
