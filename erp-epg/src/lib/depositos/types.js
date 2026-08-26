/**
 * @typedef {Object} Deposito
 * @property {string} id_deposito
 * @property {string} nombre_deposito
 * @property {string|null} direccion_deposito
 * @property {string|null} telefono_deposito
 * @property {string|null} horario_apertura
 * @property {string|null} horario_cierre
 * @property {string|null} id_responsable
 * @property {boolean} activo
 * @property {boolean} esta_lleno
 * @property {string} creado
 * @property {string} editado
 * @property {string|null} creado_por
 */

export const DEPOSITO_COLUMNS =
  "id_deposito, nombre_deposito, direccion_deposito, telefono_deposito, horario_apertura, horario_cierre, id_responsable, activo, esta_lleno, creado, editado, creado_por";
