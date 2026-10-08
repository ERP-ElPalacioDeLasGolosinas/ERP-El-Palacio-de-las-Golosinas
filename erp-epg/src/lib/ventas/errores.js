/**
 * Mapeo de los ERRCODE custom de `fn_venta_registrar` / `fn_venta_despachar`
 * a mensajes de UI.
 *
 * | Código | Campo    | Significado                                                   |
 * |--------|----------|---------------------------------------------------------------|
 * | VTA01  | cliente  | El cliente no existe o está inactivo                          |
 * | VTA02  | cliente  | El cliente no corresponde al tipo de venta                    |
 * | VTA03  | tipo     | El tipo de comprobante no es una factura de venta activa      |
 * | VTA04  | fecha    | Fecha vacía o futura (o distinta de hoy si se cobra en caja)  |
 * | VTA05  | detalle  | Sin líneas / línea incompleta / descuento mayor al importe    |
 * | VTA06  | detalle  | Artículo inexistente o inhabilitado                           |
 * | VTA07  | detalle  | Depósito inexistente o inhabilitado                           |
 * | VTA08  | detalle  | Stock insuficiente (el mensaje trae artículo y depósito)      |
 * | VTA09  | —        | La venta no existe                                            |
 * | VTA10  | —        | La venta no está en preparación (no se puede despachar)       |
 * | VTA11  | detalle  | El importe total es cero                                      |
 * | VTA12  | —        | Falta el tipo de movimiento "Salida por venta"                |
 * | VTA13  | detalle  | No hay lista vigente para el tipo de venta                    |
 * | VTA14  | detalle  | Artículo sin precio en la lista vigente                       |
 * | VTA15  | medios   | La venta mayorista no se cobra en caja                        |
 * | VTA16  | detalle  | La venta de caja incluye artículos de otro depósito           |
 * | MOV05  | detalle  | Stock insuficiente al descontar (carrera con otra operación)  |
 * | CAJ*   | medios   | Errores del cobro en caja (ver `lib/cajas/errores.js`)        |
 */

import { mapErrorCaja } from "@/lib/cajas/errores";

/** @typedef {{ field: "cliente" | "tipo" | "fecha" | "detalle" | "medios" | "caja" | null, message: string, reload?: boolean }} ErrorUI */

const MAPA = {
  VTA01: {
    field: "cliente",
    message: "El cliente no existe o está inactivo.",
    reload: true,
  },
  VTA02: {
    field: "cliente",
    message: "El cliente no corresponde al tipo de venta elegido.",
  },
  VTA03: {
    field: "tipo",
    message: "El tipo de comprobante no es una factura de venta activa.",
    reload: true,
  },
  VTA04: { field: "fecha", message: "La fecha es obligatoria y no puede ser futura." },
  VTA05: {
    field: "detalle",
    message: "Revisá los artículos: cada línea necesita depósito, artículo y cantidad mayor a cero.",
  },
  VTA06: {
    field: "detalle",
    message: "Uno de los artículos no existe o está inhabilitado.",
    reload: true,
  },
  VTA07: {
    field: "detalle",
    message: "Uno de los depósitos no existe o está inhabilitado.",
    reload: true,
  },
  VTA08: { field: "detalle", message: "Stock insuficiente para uno de los artículos." },
  VTA09: { field: null, message: "La venta no existe.", reload: true },
  VTA10: {
    field: null,
    message: "La venta ya no está en preparación. Actualizá la página.",
    reload: true,
  },
  VTA11: { field: "detalle", message: "El total de la venta tiene que ser mayor a cero." },
  VTA12: {
    field: null,
    message: "Falta el tipo de movimiento “Salida por venta”. Pedile a un administrador que lo cree o lo habilite.",
  },
  VTA13: {
    field: "detalle",
    message: "No hay una lista de precios vigente para este tipo de venta. Cargala en Listas de precios.",
    reload: true,
  },
  VTA14: { field: "detalle", message: "Un artículo no tiene precio en la lista vigente.", reload: true },
  VTA15: {
    field: "medios",
    message: "La venta mayorista se cobra en Tesorería una vez despachada.",
  },
  VTA16: {
    field: "detalle",
    message: "La venta de caja solo puede incluir artículos del depósito de la caja.",
  },
  MOV05: {
    field: "detalle",
    message: "El stock cambió mientras cargabas la venta. Revisá las cantidades.",
    reload: true,
  },
};

const CON_MENSAJE_DE_BASE = new Set(["VTA02", "VTA04", "VTA05", "VTA08", "VTA10", "VTA13", "VTA14", "VTA16", "MOV05"]);

/**
 * @param {{ code?: string | null, error?: string | null } | null | undefined} result
 * @returns {ErrorUI}
 */
export function mapErrorVenta(result) {
  const code = result?.code ?? null;

  if (code?.startsWith("CAJ")) {
    const ui = mapErrorCaja(result);
    const enMedios = code === "CAJ06" || code === "CAJ07" || code === "CAJ08" || code === "CAJ09" || code === "CAJ15";
    return { ...ui, field: enMedios ? "medios" : "caja" };
  }

  if (code && MAPA[code]) {
    if (CON_MENSAJE_DE_BASE.has(code) && result?.error) {
      return { ...MAPA[code], message: result.error };
    }
    return MAPA[code];
  }

  return {
    field: null,
    message: result?.error || "No se pudo registrar la venta.",
  };
}
