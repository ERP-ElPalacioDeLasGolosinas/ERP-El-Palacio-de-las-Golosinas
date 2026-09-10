"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registrarComprobante } from "@/lib/comprobantes/actions";
import { mapErrorComprobante } from "@/lib/comprobantes/errores";

const monedaFmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

let contadorLinea = 0;
function nuevaLinea() {
  contadorLinea += 1;
  return {
    key: `l${contadorLinea}`,
    modo: "producto", // "producto" | "concepto"
    id_producto: "",
    concepto: "",
    cantidad: "",
    precio_unitario: "",
    descuento: "",
    impuesto: "",
  };
}

/** Importe neto de una línea: cantidad × precio − descuento + impuesto. */
function importeLinea(l) {
  const c = Number(l.cantidad) || 0;
  const p = Number(l.precio_unitario) || 0;
  const d = Number(l.descuento) || 0;
  const i = Number(l.impuesto) || 0;
  return c * p - d + i;
}

/**
 * C-05 · Alta de comprobante de proveedor: cabecera + grilla de líneas en una
 * sola pantalla, enviadas juntas a `fn_comprobante_registrar`. El importe total
 * y el desglose (subtotal / descuento / impuesto) se calculan desde el detalle.
 *
 * @param {{
 *   proveedores: Array<{ id_proveedor: string, nombre_proveedor: string }>,
 *   tipos: Array<{ id_tipo_comprobante: string, nombre_tipo_comprobante: string, letra: string | null }>,
 *   productos: Array<{ id_producto: string, nombre_completo: string, codigo_producto?: string | null }>,
 * }} props
 */
export function ComprobanteForm({ proveedores, tipos, productos }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [cab, setCab] = useState({
    id_proveedor: "",
    id_tipo_comprobante: "",
    punto_venta: "",
    numero: "",
    fecha_comprobante: "",
    fecha_vencimiento: "",
    observaciones: "",
  });
  const [lineas, setLineas] = useState([nuevaLinea()]);
  const [errores, setErrores] = useState({});
  const [errorServer, setErrorServer] = useState(null);

  function setCampo(campo, valor) {
    setCab((prev) => ({ ...prev, [campo]: valor }));
    setErrores((prev) => ({ ...prev, [campo]: null }));
    setErrorServer(null);
  }

  function setLinea(idx, cambios) {
    setLineas((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, ...cambios } : l))
    );
    setErrores((prev) => ({ ...prev, detalle: null }));
    setErrorServer(null);
  }

  function agregarLinea() {
    setLineas((prev) => [...prev, nuevaLinea()]);
  }

  function quitarLinea(idx) {
    setLineas((prev) =>
      prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)
    );
  }

  const totales = useMemo(() => {
    let subtotal = 0;
    let descuento = 0;
    let impuesto = 0;
    for (const l of lineas) {
      subtotal += (Number(l.cantidad) || 0) * (Number(l.precio_unitario) || 0);
      descuento += Number(l.descuento) || 0;
      impuesto += Number(l.impuesto) || 0;
    }
    const round = (n) => Math.round(n * 100) / 100;
    return {
      subtotal: round(subtotal),
      descuento: round(descuento),
      impuesto: round(impuesto),
      importe_total: round(subtotal - descuento + impuesto),
    };
  }, [lineas]);

  function validar() {
    const next = {};
    if (!cab.id_proveedor) next.id_proveedor = "Elegí un proveedor.";
    if (!cab.id_tipo_comprobante) next.id_tipo_comprobante = "Elegí un tipo.";
    if (!(Number(cab.punto_venta) > 0))
      next.numero = "El punto de venta debe ser mayor a cero.";
    else if (!(Number(cab.numero) > 0))
      next.numero = "El número debe ser mayor a cero.";
    if (!cab.fecha_comprobante)
      next.fechas = "La fecha del comprobante es obligatoria.";
    else if (
      cab.fecha_vencimiento &&
      cab.fecha_vencimiento < cab.fecha_comprobante
    )
      next.fechas = "El vencimiento no puede ser anterior al comprobante.";

    const lineasValidas = lineas.filter((l) => {
      const tieneItem =
        l.modo === "producto" ? Boolean(l.id_producto) : Boolean(l.concepto.trim());
      return (
        tieneItem &&
        Number(l.cantidad) > 0 &&
        Number(l.precio_unitario) >= 0 &&
        (Number(l.descuento) || 0) >= 0 &&
        (Number(l.impuesto) || 0) >= 0
      );
    });
    if (lineasValidas.length !== lineas.length || lineas.length === 0)
      next.detalle =
        "Cada línea necesita artículo o concepto, cantidad mayor a cero y montos no negativos.";
    else if (!(totales.importe_total > 0))
      next.detalle = "El importe total del comprobante debe ser mayor a cero.";

    setErrores(next);
    return Object.keys(next).length === 0;
  }

  function registrar() {
    setErrorServer(null);
    if (!validar()) return;

    startTransition(async () => {
      const result = await registrarComprobante({
        id_proveedor: cab.id_proveedor,
        id_tipo_comprobante: cab.id_tipo_comprobante,
        punto_venta: cab.punto_venta,
        numero: cab.numero,
        fecha_comprobante: cab.fecha_comprobante,
        fecha_vencimiento: cab.fecha_vencimiento || null,
        observaciones: cab.observaciones || null,
        detalle: lineas.map((l) => ({
          id_producto: l.modo === "producto" ? l.id_producto : null,
          concepto: l.modo === "concepto" ? l.concepto : null,
          cantidad: l.cantidad,
          precio_unitario: l.precio_unitario,
          descuento: l.descuento || 0,
          impuesto: l.impuesto || 0,
        })),
      });

      if (!result.ok) {
        const ui = mapErrorComprobante(result);
        if (ui.field) {
          setErrores((prev) => ({ ...prev, [ui.field]: ui.message }));
        } else {
          setErrorServer(ui.message);
        }
        if (ui.reload) router.refresh();
        return;
      }

      router.push("/compras/comprobantes");
      router.refresh();
    });
  }

  return (
    <>
      {/* Cabecera */}
      <div className="palacio-card p-5 md:p-6">
        <h2 className="mb-4 text-sm font-semibold text-zinc-900">
          Datos del comprobante
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Campo label="Proveedor" error={errores.id_proveedor} requerido>
            <select
              value={cab.id_proveedor}
              onChange={(e) => setCampo("id_proveedor", e.target.value)}
              className="palacio-input"
            >
              <option value="">Seleccioná un proveedor…</option>
              {proveedores.map((p) => (
                <option key={p.id_proveedor} value={p.id_proveedor}>
                  {p.nombre_proveedor}
                </option>
              ))}
            </select>
          </Campo>

          <Campo
            label="Tipo de comprobante"
            error={errores.id_tipo_comprobante}
            requerido
          >
            <select
              value={cab.id_tipo_comprobante}
              onChange={(e) => setCampo("id_tipo_comprobante", e.target.value)}
              className="palacio-input"
            >
              <option value="">Seleccioná un tipo…</option>
              {tipos.map((t) => (
                <option
                  key={t.id_tipo_comprobante}
                  value={t.id_tipo_comprobante}
                >
                  {t.nombre_tipo_comprobante}
                  {t.letra ? ` (${t.letra})` : ""}
                </option>
              ))}
            </select>
          </Campo>

          <Campo label="Punto de venta" error={errores.numero} requerido>
            <input
              type="number"
              min="1"
              step="1"
              value={cab.punto_venta}
              onChange={(e) => setCampo("punto_venta", e.target.value)}
              className="palacio-input"
              placeholder="Ej: 1"
            />
          </Campo>

          <Campo label="Número" requerido>
            <input
              type="number"
              min="1"
              step="1"
              value={cab.numero}
              onChange={(e) => setCampo("numero", e.target.value)}
              className="palacio-input"
              placeholder="Ej: 12345"
            />
          </Campo>

          <Campo
            label="Fecha del comprobante"
            error={errores.fechas}
            requerido
          >
            <input
              type="date"
              value={cab.fecha_comprobante}
              onChange={(e) => setCampo("fecha_comprobante", e.target.value)}
              className="palacio-input"
            />
          </Campo>

          <Campo label="Vencimiento (opcional)">
            <input
              type="date"
              value={cab.fecha_vencimiento}
              onChange={(e) => setCampo("fecha_vencimiento", e.target.value)}
              className="palacio-input"
            />
          </Campo>

          <Campo label="Observaciones (opcional)" full>
            <textarea
              value={cab.observaciones}
              onChange={(e) => setCampo("observaciones", e.target.value)}
              rows={2}
              maxLength={500}
              className="palacio-input"
              placeholder="Remito, orden de compra, notas…"
            />
          </Campo>
        </div>
      </div>

      {/* Detalle */}
      <div className="palacio-card mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">
            Detalle del comprobante
          </h2>
          <span className="text-xs text-palacio-muted">
            {lineas.length} línea{lineas.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-palacio-border bg-zinc-50/80">
                <Th className="w-28">Tipo</Th>
                <Th>Artículo / concepto</Th>
                <Th className="w-24 text-right">Cantidad</Th>
                <Th className="w-28 text-right">Precio unit.</Th>
                <Th className="w-28 text-right">Descuento</Th>
                <Th className="w-28 text-right">Impuesto</Th>
                <Th className="w-32 text-right">Importe</Th>
                <Th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {lineas.map((l, idx) => (
                <tr
                  key={l.key}
                  className="border-b border-palacio-border last:border-0"
                >
                  <td className="px-3 py-2 align-top">
                    <select
                      value={l.modo}
                      onChange={(e) =>
                        setLinea(idx, {
                          modo: e.target.value,
                          id_producto: "",
                          concepto: "",
                        })
                      }
                      className="palacio-input"
                    >
                      <option value="producto">Artículo</option>
                      <option value="concepto">Concepto</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 align-top">
                    {l.modo === "producto" ? (
                      <select
                        value={l.id_producto}
                        onChange={(e) =>
                          setLinea(idx, { id_producto: e.target.value })
                        }
                        className="palacio-input"
                      >
                        <option value="">Seleccioná un artículo…</option>
                        {productos.map((p) => (
                          <option key={p.id_producto} value={p.id_producto}>
                            {p.nombre_completo}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={l.concepto}
                        onChange={(e) =>
                          setLinea(idx, { concepto: e.target.value })
                        }
                        className="palacio-input"
                        placeholder="Flete, servicio, ajuste…"
                        maxLength={200}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 text-right align-top">
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={l.cantidad}
                      onChange={(e) =>
                        setLinea(idx, { cantidad: e.target.value })
                      }
                      className="palacio-input text-right"
                    />
                  </td>
                  <td className="px-3 py-2 text-right align-top">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={l.precio_unitario}
                      onChange={(e) =>
                        setLinea(idx, { precio_unitario: e.target.value })
                      }
                      className="palacio-input text-right"
                    />
                  </td>
                  <td className="px-3 py-2 text-right align-top">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={l.descuento}
                      onChange={(e) =>
                        setLinea(idx, { descuento: e.target.value })
                      }
                      className="palacio-input text-right"
                      placeholder="0.00"
                    />
                  </td>
                  <td className="px-3 py-2 text-right align-top">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={l.impuesto}
                      onChange={(e) =>
                        setLinea(idx, { impuesto: e.target.value })
                      }
                      className="palacio-input text-right"
                      placeholder="0.00"
                    />
                  </td>
                  <td className="px-3 py-2 text-right align-middle font-medium text-zinc-800">
                    {monedaFmt.format(importeLinea(l))}
                  </td>
                  <td className="px-3 py-2 text-right align-middle">
                    <button
                      type="button"
                      onClick={() => quitarLinea(idx)}
                      disabled={lineas.length === 1}
                      className="palacio-action-btn palacio-action-danger"
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3 border-t border-palacio-border px-5 py-3">
          <button
            type="button"
            onClick={agregarLinea}
            className="palacio-btn-secondary px-3 py-2 text-sm"
          >
            Agregar línea
          </button>
          <dl className="min-w-52 space-y-1 text-right text-sm">
            <div className="flex justify-between gap-6">
              <dt className="text-palacio-muted">Subtotal</dt>
              <dd className="tabular-nums">{monedaFmt.format(totales.subtotal)}</dd>
            </div>
            <div className="flex justify-between gap-6">
              <dt className="text-palacio-muted">Descuentos</dt>
              <dd className="tabular-nums">
                −{monedaFmt.format(totales.descuento)}
              </dd>
            </div>
            <div className="flex justify-between gap-6">
              <dt className="text-palacio-muted">Impuestos</dt>
              <dd className="tabular-nums">
                {monedaFmt.format(totales.impuesto)}
              </dd>
            </div>
            <div className="flex justify-between gap-6 border-t border-palacio-border pt-1 font-semibold text-zinc-900">
              <dt>Importe total</dt>
              <dd className="tabular-nums">
                {monedaFmt.format(totales.importe_total)}
              </dd>
            </div>
          </dl>
        </div>

        {errores.detalle ? (
          <p className="mx-5 mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errores.detalle}
          </p>
        ) : null}

        {errorServer ? (
          <p className="mx-5 mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorServer}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t border-palacio-border px-5 py-4">
          <button
            type="button"
            onClick={registrar}
            disabled={pending}
            className="palacio-btn-primary px-4 py-2.5 text-sm"
          >
            {pending ? "Registrando…" : "Registrar comprobante"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/compras/comprobantes")}
            disabled={pending}
            className="palacio-btn-secondary px-4 py-2.5 text-sm"
          >
            Cancelar
          </button>
        </div>
      </div>
    </>
  );
}

function Campo({ label, error, requerido = false, full = false, children }) {
  return (
    <div className={`flex flex-col gap-1.5 ${full ? "md:col-span-2" : ""}`}>
      <label className="text-sm font-medium text-zinc-800">
        {label} {requerido ? <span className="text-palacio-red">*</span> : null}
      </label>
      {children}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

function Th({ children, className = "" }) {
  return (
    <th
      className={`px-3 py-2 text-[11px] font-semibold tracking-wider text-palacio-muted uppercase ${className}`}
    >
      {children}
    </th>
  );
}
