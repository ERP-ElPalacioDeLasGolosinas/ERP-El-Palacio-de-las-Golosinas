"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const PATH = "/compras/comprobantes";

/**
 * @param {{ message?: string, code?: string } | null | undefined} error
 * @param {string} fallback
 */
function errorResult(error, fallback) {
  return {
    ok: false,
    code: error?.code ?? null,
    error: error?.message || fallback,
  };
}

/** @param {unknown} valor @returns {number | null} */
function numero(valor) {
  if (valor == null || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

/** @param {unknown} valor @returns {string | null} */
function textoOpcional(valor) {
  if (valor == null) return null;
  const s = String(valor).trim();
  return s.length > 0 ? s : null;
}

/**
 * Lista comprobantes de proveedor vía `fn_comprobante_listar`. Cada fila
 * incluye `clase` e `id_tipo_comprobante` (S2-7).
 *
 * @param {{ idProveedor?: string | null, soloPendientes?: boolean, desde?: string | null, hasta?: string | null, estado?: string | null, idTipoComprobante?: string | null }} [filtros]
 * @returns {Promise<{ data: Array<Record<string, unknown>> | null, error: string | null }>}
 */
export async function listarComprobantes(filtros = {}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_comprobante_listar", {
    p_id_proveedor: filtros.idProveedor || null,
    p_solo_pendientes: Boolean(filtros.soloPendientes),
    p_desde: filtros.desde || null,
    p_hasta: filtros.hasta || null,
    p_estado: filtros.estado || null,
    p_id_tipo_comprobante: filtros.idTipoComprobante || null,
  });

  if (error) {
    return { data: null, error: "No se pudieron cargar los comprobantes." };
  }

  return { data: data ?? [], error: null };
}

/**
 * Totales agregados de comprobantes vía `fn_comprobante_resumen`, para el
 * mismo conjunto que `listarComprobantes` filtra por proveedor, rango de
 * fechas y estado (T-C2).
 *
 * @param {{ idProveedor?: string | null, desde?: string | null, hasta?: string | null, estado?: string | null }} [filtros]
 * @returns {Promise<{ data: { cantidad: number, importe_total: number, importe_pagado: number, saldo_pendiente: number } | null, error: string | null }>}
 */
export async function obtenerResumenComprobantes(filtros = {}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_comprobante_resumen", {
    p_id_proveedor: filtros.idProveedor || null,
    p_desde: filtros.desde || null,
    p_hasta: filtros.hasta || null,
    p_estado: filtros.estado || null,
  });

  if (error) {
    return { data: null, error: "No se pudo cargar el resumen de comprobantes." };
  }

  const fila = Array.isArray(data) ? data[0] : data;
  if (!fila) {
    return {
      data: { cantidad: 0, importe_total: 0, importe_pagado: 0, saldo_pendiente: 0 },
      error: null,
    };
  }

  return {
    data: {
      cantidad: Number(fila.cantidad) || 0,
      importe_total: Number(fila.importe_total) || 0,
      importe_pagado: Number(fila.importe_pagado) || 0,
      saldo_pendiente: Number(fila.saldo_pendiente) || 0,
    },
    error: null,
  };
}

/**
 * Comprobantes de un proveedor con saldo pendiente > 0 (no anulados,
 * estado ≠ `Pagado`) vía `fn_comprobante_pendientes_listar` (S2-2c / C-12).
 *
 * @param {string} idProveedor
 * @param {"fecha" | "vencimiento"} [orden="fecha"]
 * @returns {Promise<{ data: Array<Record<string, unknown>> | null, error: string | null }>}
 */
export async function listarComprobantesPendientes(idProveedor, orden = "fecha") {
  if (!idProveedor) {
    return { data: [], error: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_comprobante_pendientes_listar", {
    p_id_proveedor: idProveedor,
    p_orden: orden === "vencimiento" ? "vencimiento" : "fecha",
  });

  if (error) {
    return { data: null, error: "No se pudieron cargar los comprobantes pendientes." };
  }

  return { data: data ?? [], error: null };
}

/**
 * Cantidad y suma de saldos pendientes de un proveedor vía
 * `fn_comprobante_pendientes_resumen` (S2-2c / C-12).
 *
 * @param {string} idProveedor
 * @returns {Promise<{ data: { cantidad: number, saldo_pendiente: number } | null, error: string | null }>}
 */
export async function obtenerResumenPendientes(idProveedor) {
  if (!idProveedor) {
    return { data: { cantidad: 0, saldo_pendiente: 0 }, error: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_comprobante_pendientes_resumen", {
    p_id_proveedor: idProveedor,
  });

  if (error) {
    return { data: null, error: "No se pudo cargar el resumen de pendientes." };
  }

  const fila = Array.isArray(data) ? data[0] : data;
  return {
    data: {
      cantidad: Number(fila?.cantidad) || 0,
      saldo_pendiente: Number(fila?.saldo_pendiente) || 0,
    },
    error: null,
  };
}

/**
 * Cabecera enriquecida de un comprobante vía `fn_comprobante_obtener`
 * (proveedor, tipo, número formateado, desglose subtotal/descuento/impuesto,
 * importe total, saldo, `creado_por_nombre` y `total_detalle`).
 *
 * @param {string} id_comprobante
 * @returns {Promise<{ data: Record<string, unknown> | null, error: string | null }>}
 */
export async function obtenerComprobante(id_comprobante) {
  if (!id_comprobante) {
    return { data: null, error: "Falta el identificador del comprobante." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_comprobante_obtener", {
    p_id_comprobante: id_comprobante,
  });

  if (error) {
    return { data: null, error: "No se pudo cargar el comprobante." };
  }

  const fila = Array.isArray(data) ? data[0] : data;
  return { data: fila ?? null, error: null };
}

/**
 * Líneas de un comprobante vía `fn_comprobante_detalle_listar`.
 *
 * @param {string} id_comprobante
 * @returns {Promise<{ data: Array<Record<string, unknown>> | null, error: string | null }>}
 */
export async function listarDetalleComprobante(id_comprobante) {
  if (!id_comprobante) {
    return { data: null, error: "Falta el identificador del comprobante." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_comprobante_detalle_listar", {
    p_id_comprobante: id_comprobante,
  });

  if (error) {
    return { data: null, error: "No se pudo cargar el detalle del comprobante." };
  }

  return { data: data ?? [], error: null };
}

/**
 * Facturas de compra disponibles para recepción (aplican a compra, no
 * anuladas y todavía sin lote) vía `fn_comprobante_listar_para_recepcion`.
 * Alimenta el selector de "Ingreso por compra" en Registrar movimiento.
 *
 * @returns {Promise<{ data: Array<Record<string, unknown>> | null, error: string | null }>}
 */
export async function listarComprobantesParaRecepcion() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "fn_comprobante_listar_para_recepcion"
  );

  if (error) {
    return { data: null, error: "No se pudieron cargar las facturas para recepción." };
  }

  return { data: data ?? [], error: null };
}

/**
 * Órdenes de pago que imputan un comprobante, con su importe imputado y el
 * estado de la orden, vía `fn_comprobante_ordenes_pago_listar` (T-07).
 *
 * @param {string} id_comprobante
 * @returns {Promise<{ data: Array<Record<string, unknown>> | null, error: string | null }>}
 */
export async function listarOrdenesPagoComprobante(id_comprobante) {
  if (!id_comprobante) {
    return { data: null, error: "Falta el identificador del comprobante." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "fn_comprobante_ordenes_pago_listar",
    { p_id_comprobante: id_comprobante }
  );

  if (error) {
    return { data: null, error: "No se pudieron cargar las órdenes de pago del comprobante." };
  }

  return { data: data ?? [], error: null };
}

/**
 * Alta transaccional de un comprobante con su detalle. El importe total y el
 * desglose (subtotal / descuento_total / impuesto_total) se calculan en la
 * base a partir de las líneas.
 *
 * @param {{
 *   id_proveedor: string,
 *   id_tipo_comprobante: string,
 *   punto_venta: number | string,
 *   numero: number | string,
 *   fecha_comprobante: string,
 *   fecha_vencimiento?: string | null,
 *   observaciones?: string | null,
 *   detalle: Array<{
 *     id_producto?: string | null,
 *     concepto?: string | null,
 *     cantidad: number | string,
 *     precio_unitario: number | string,
 *     descuento?: number | string,
 *     impuesto?: number | string,
 *   }>,
 * }} entrada
 * @returns {Promise<{ ok: boolean, error: string | null, code?: string | null }>}
 */
export async function registrarComprobante(entrada) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      code: null,
      error: "Debés iniciar sesión para registrar un comprobante.",
    };
  }

  const detalle = Array.isArray(entrada.detalle) ? entrada.detalle : [];

  const { error } = await supabase.rpc("fn_comprobante_registrar", {
    p_id_proveedor: entrada.id_proveedor || null,
    p_id_tipo_comprobante: entrada.id_tipo_comprobante || null,
    p_punto_venta: numero(entrada.punto_venta),
    p_numero: numero(entrada.numero),
    p_fecha_comprobante: entrada.fecha_comprobante || null,
    p_fecha_vencimiento: entrada.fecha_vencimiento || null,
    p_observaciones: textoOpcional(entrada.observaciones),
    p_detalle: detalle.map((linea) => ({
      id_producto: linea.id_producto || null,
      concepto: textoOpcional(linea.concepto),
      cantidad: numero(linea.cantidad),
      precio_unitario: numero(linea.precio_unitario),
      descuento: numero(linea.descuento) ?? 0,
      impuesto: numero(linea.impuesto) ?? 0,
    })),
    p_creado_por: user.id,
  });

  if (error) {
    return errorResult(error, "No se pudo registrar el comprobante.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

/**
 * Alta transaccional de una nota de débito de proveedor (cabecera en
 * `comprobante_proveedor` + `nota_debito_proveedor` + su detalle de
 * conceptos) vía `fn_nota_debito_registrar` (S2-7). La cabecera queda en
 * estado `Pendiente` con `saldo_pendiente = importe_total`.
 *
 * @param {{
 *   id_proveedor: string,
 *   id_tipo_comprobante: string,
 *   punto_venta: number | string,
 *   numero: number | string,
 *   fecha_comprobante: string,
 *   id_comprobante_asociado?: string | null,
 *   motivo: string,
 *   observaciones?: string | null,
 *   detalle: Array<{ concepto: string, importe: number | string, impuesto?: number | string }>,
 * }} entrada
 * @returns {Promise<{ ok: boolean, error: string | null, code?: string | null }>}
 */
export async function registrarNotaDebito(entrada) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      code: null,
      error: "Debés iniciar sesión para registrar una nota de débito.",
    };
  }

  const detalle = Array.isArray(entrada.detalle) ? entrada.detalle : [];

  const { error } = await supabase.rpc("fn_nota_debito_registrar", {
    p_id_proveedor: entrada.id_proveedor || null,
    p_id_tipo_comprobante: entrada.id_tipo_comprobante || null,
    p_punto_venta: numero(entrada.punto_venta),
    p_numero: numero(entrada.numero),
    p_fecha_comprobante: entrada.fecha_comprobante || null,
    p_id_comprobante_asociado: entrada.id_comprobante_asociado || null,
    p_motivo: textoOpcional(entrada.motivo),
    p_observaciones: textoOpcional(entrada.observaciones),
    p_detalle: detalle.map((linea) => ({
      concepto: textoOpcional(linea.concepto),
      importe: numero(linea.importe) ?? 0,
      impuesto: numero(linea.impuesto) ?? 0,
    })),
    p_creado_por: user.id,
  });

  if (error) {
    return errorResult(error, "No se pudo registrar la nota de débito.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

/**
 * Alta transaccional de un remito de proveedor (cabecera con importes en
 * cero + `remito_proveedor` + su detalle de productos/cantidades) vía
 * `fn_remito_registrar` (S2-7). No alimenta stock: la recepción sigue
 * siendo contra factura (D-020).
 *
 * @param {{
 *   id_proveedor: string,
 *   id_tipo_comprobante: string,
 *   punto_venta: number | string,
 *   numero: number | string,
 *   fecha_comprobante: string,
 *   id_comprobante_asociado?: string | null,
 *   observaciones?: string | null,
 *   detalle: Array<{ id_producto: string, cantidad: number | string }>,
 * }} entrada
 * @returns {Promise<{ ok: boolean, error: string | null, code?: string | null }>}
 */
export async function registrarRemito(entrada) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      code: null,
      error: "Debés iniciar sesión para registrar un remito.",
    };
  }

  const detalle = Array.isArray(entrada.detalle) ? entrada.detalle : [];

  const { error } = await supabase.rpc("fn_remito_registrar", {
    p_id_proveedor: entrada.id_proveedor || null,
    p_id_tipo_comprobante: entrada.id_tipo_comprobante || null,
    p_punto_venta: numero(entrada.punto_venta),
    p_numero: numero(entrada.numero),
    p_fecha_comprobante: entrada.fecha_comprobante || null,
    p_id_comprobante_asociado: entrada.id_comprobante_asociado || null,
    p_observaciones: textoOpcional(entrada.observaciones),
    p_detalle: detalle.map((linea) => ({
      id_producto: linea.id_producto || null,
      cantidad: numero(linea.cantidad),
    })),
    p_creado_por: user.id,
  });

  if (error) {
    return errorResult(error, "No se pudo registrar el remito.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

/**
 * Alta transaccional de una nota de crédito de proveedor (cabecera en
 * `comprobante_proveedor` + `nota_credito_proveedor` + su detalle) vía
 * `fn_nota_credito_registrar` (S2-7). La factura asociada es obligatoria.
 * Según `motivo`: `devolucion_mercaderia` exige líneas con producto,
 * cantidad, precio e `id_detalle_origen` (línea de la factura); el resto
 * exige concepto + importe. La cabecera queda en `Pendiente` con
 * `saldo_pendiente = 0` y **no** modifica el saldo de la factura de origen.
 *
 * @param {{
 *   id_proveedor: string,
 *   id_tipo_comprobante: string,
 *   punto_venta: number | string,
 *   numero: number | string,
 *   fecha_comprobante: string,
 *   id_comprobante_asociado: string,
 *   motivo: string,
 *   observaciones?: string | null,
 *   detalle: Array<{
 *     id_producto?: string | null,
 *     id_detalle_origen?: string | null,
 *     concepto?: string | null,
 *     cantidad?: number | string | null,
 *     precio_unitario?: number | string | null,
 *     importe: number | string,
 *     impuesto?: number | string,
 *   }>,
 * }} entrada
 * @returns {Promise<{ ok: boolean, error: string | null, code?: string | null }>}
 */
export async function registrarNotaCredito(entrada) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      code: null,
      error: "Debés iniciar sesión para registrar una nota de crédito.",
    };
  }

  const detalle = Array.isArray(entrada.detalle) ? entrada.detalle : [];

  const { error } = await supabase.rpc("fn_nota_credito_registrar", {
    p_id_proveedor: entrada.id_proveedor || null,
    p_id_tipo_comprobante: entrada.id_tipo_comprobante || null,
    p_punto_venta: numero(entrada.punto_venta),
    p_numero: numero(entrada.numero),
    p_fecha_comprobante: entrada.fecha_comprobante || null,
    p_id_comprobante_asociado: entrada.id_comprobante_asociado || null,
    p_motivo: textoOpcional(entrada.motivo),
    p_observaciones: textoOpcional(entrada.observaciones),
    p_detalle: detalle.map((linea) => ({
      id_producto: linea.id_producto || null,
      id_detalle_origen: linea.id_detalle_origen || null,
      concepto: textoOpcional(linea.concepto),
      cantidad: numero(linea.cantidad),
      precio_unitario: numero(linea.precio_unitario),
      importe: numero(linea.importe) ?? 0,
      impuesto: numero(linea.impuesto) ?? 0,
    })),
    p_creado_por: user.id,
  });

  if (error) {
    return errorResult(error, "No se pudo registrar la nota de crédito.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

/**
 * Anula (baja lógica) un comprobante.
 *
 * @param {string} id_comprobante
 * @returns {Promise<{ ok: boolean, error: string | null, code?: string | null }>}
 */
export async function anularComprobante(id_comprobante) {
  if (!id_comprobante) {
    return {
      ok: false,
      code: null,
      error: "Falta el identificador del comprobante.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_comprobante_anular", {
    p_id_comprobante: id_comprobante,
  });

  if (error) {
    return errorResult(error, "No se pudo anular el comprobante.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}
