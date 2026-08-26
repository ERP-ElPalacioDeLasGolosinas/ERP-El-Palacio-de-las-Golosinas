/**
 * @typedef {Object} Categoria
 * @property {string} id_categoria
 * @property {string} id_rubro
 * @property {string} nombre_categoria
 * @property {boolean} activo
 * @property {string} creado
 * @property {string} editado
 * @property {string|null} creado_por
 * @property {{ id_rubro: string, nombre_rubro: string, activo: boolean } | null} [rubro]
 */

export const CATEGORIA_COLUMNS =
  "id_categoria, id_rubro, nombre_categoria, activo, creado, editado, creado_por";

/** Select con join al rubro para listados / formularios. */
export const CATEGORIA_SELECT_CON_RUBRO = `${CATEGORIA_COLUMNS}, rubro:id_rubro ( id_rubro, nombre_rubro, activo )`;
