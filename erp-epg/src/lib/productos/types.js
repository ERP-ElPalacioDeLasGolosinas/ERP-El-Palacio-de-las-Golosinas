/**
 * @typedef {Object} Producto
 * @property {string} id_producto
 * @property {string} id_marca
 * @property {string} id_unidad_medida
 * @property {string} id_categoria
 * @property {string} nombre_producto
 * @property {string} descripcion_producto
 * @property {string} codigo_producto
 * @property {number} precio_costo_producto
 * @property {number|null} precio_venta_mayorista_producto
 * @property {number|null} precio_venta_sugerido_producto
 * @property {boolean} activo
 * @property {string} creado
 * @property {string} editado
 * @property {string|null} creado_por
 * @property {{ id_marca: string, nombre_marca: string, activo: boolean } | null} [marca]
 * @property {{ id_unidad_medida: string, nombre_unidad_medida: string, abreviatura_unidad_medida: string, activo: boolean } | null} [unidad_medida]
 * @property {{ id_categoria: string, nombre_categoria: string, activo: boolean, id_rubro: string, rubro?: { id_rubro: string, nombre_rubro: string, activo: boolean } | null } | null} [categoria]
 */

export const PRODUCTO_COLUMNS =
  "id_producto, id_marca, id_unidad_medida, id_categoria, nombre_producto, descripcion_producto, codigo_producto, precio_costo_producto, precio_venta_mayorista_producto, precio_venta_sugerido_producto, activo, creado, editado, creado_por";

/** Select con joins para listados / formularios. */
export const PRODUCTO_SELECT_CON_RELACIONES = `${PRODUCTO_COLUMNS},
  marca:id_marca ( id_marca, nombre_marca, activo ),
  unidad_medida:id_unidad_medida ( id_unidad_medida, nombre_unidad_medida, abreviatura_unidad_medida, activo ),
  categoria:id_categoria ( id_categoria, nombre_categoria, activo, id_rubro, rubro:id_rubro ( id_rubro, nombre_rubro, activo ) )`;
