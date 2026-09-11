"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  listarDetalleComprobante,
  registrarNotaCredito,
} from "@/lib/comprobantes/actions";
import { mapErrorComprobante } from "@/lib/comprobantes/errores";
import { Campo, Th, monedaFmt } from "./ui";
import { FacturaAsociadaSelect } from "./FacturaAsociada";

const CAMPOS_CABECERA = ["id_proveedor", "id_tipo_comprobante", "numero", "fechas"];

const MOTIVOS = [
  { value: "devolucion_mercaderia", label: "Devolución de mercadería" },
  { value: "bonificacion", label: "Bonificación / ajuste" },
  { value: "error_facturacion", label: "Error de facturación" },
  { value: "anulacion", label: "Anulación" },
];

let contadorLinea = 0;
function nuevaLineaConcepto() {
  contadorLinea += 1;
  return { key: `c${contadorLinea}`, concepto: "", importe: "", impuesto: "" };
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** Importe de una línea de concepto: importe + impuesto. */
function importeConcepto(l) {
  return (Number(l.importe) || 0) + (Number(l.impuesto) || 0);
}

/** Importe a acreditar de una línea de devolución: cantidad × precio unitario. */
function importeDevolucion(sel) {
  return round2((Number(sel.cantidad) || 0) * (Number(sel.precio_unitario) || 0));
}

/**
 * Campos de alta de una nota de crédito: factura asociada obligatoria +
 * motivo. Si el motivo es "Devolución de mercadería" se traen las líneas de
 * la factura asociada y se eligen productos y cantidades a acreditar (tope
 * por línea, guardando `id_detalle_origen`); en el resto de los motivos es
 * una grilla de concepto + importe. Se envía a `fn_nota_credito_registrar`.
 *
 * @param {{
 *   cab: Record<string, string>,
 *   facturas: Array<Record<string, any>>,
 *   validarCabecera: () => boolean,
 *   setErrorCabecera: (campo: string, mensaje: string) => void,
 *   errorServer: string | null,
 *   setErrorServer: (mensaje: string | null) => void,
 * }} props
 */
export function NotaCreditoCampos({
  cab,
  facturas,
  validarCabecera,
  setErrorCabecera,
  errorServer,
  setErrorServer,
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [asociado, setAsociado] = useState("");
  const [motivo, setMotivo] = useState("");
  const [errores, setErrores] = useState({});

  // Motivo "bonificación / ajuste" y afines: grilla de concepto + importe.
  const [lineas, setLineas] = useState([nuevaLineaConcepto()]);

  // Motivo "devolución de mercadería": líneas traídas de la factura asociada
  // + selección editable por línea.
  const [detalleFactura, setDetalleFactura] = useState([]);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorDetalleFactura, setErrorDetalleFactura] = useState(null);
  const [seleccion, setSeleccion] = useState({}); // id_detalle -> { checked, cantidad }
  const reqRef = useRef(0);

  const esDevolucion = motivo === "devolucion_mercaderia";

  function limpiar(campo) {
    setErrores((prev) => ({ ...prev, [campo]: null }));
    setErrorServer(null);
  }

  function limpiarDetalleFactura() {
    reqRef.current += 1;
    setDetalleFactura([]);
    setSeleccion({});
    setErrorDetalleFactura(null);
    setCargandoDetalle(false);
  }

  /**
   * Trae las líneas de la factura asociada para la devolución de mercadería.
   * Se dispara desde los `onChange` de factura y motivo (patrón de
   * `cargarCuentas` en `PagoForm`), no desde un efecto.
   */
  async function cargarDetalleFactura(idFactura) {
    const token = (reqRef.current += 1);
    setCargandoDetalle(true);
    setErrorDetalleFactura(null);

    const res = await listarDetalleComprobante(idFactura);
    if (token !== reqRef.current) return;

    setCargandoDetalle(false);
    if (res.error || !res.data) {
      setDetalleFactura([]);
      setSeleccion({});
      setErrorDetalleFactura(
        res.error || "No se pudo cargar el detalle de la factura."
      );
      return;
    }

    const soloProductos = res.data.filter((d) => Boolean(d.id_producto));
    setDetalleFactura(soloProductos);
    setSeleccion(
      Object.fromEntries(
        soloProductos.map((d) => [
          d.id_detalle,
          {
            checked: false,
            cantidad: String(d.cantidad ?? ""),
            precio_unitario: Number(d.precio_unitario) || 0,
          },
        ])
      )
    );
  }

  function setLineaConcepto(idx, cambios) {
    setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...cambios } : l)));
    limpiar("detalle");
  }
  function agregarLinea() {
    setLineas((prev) => [...prev, nuevaLineaConcepto()]);
  }
  function quitarLinea(idx) {
    setLineas((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  function setSeleccionLinea(id, cambios) {
    setSeleccion((prev) => ({ ...prev, [id]: { ...prev[id], ...cambios } }));
    limpiar("detalle");
  }

  const total = useMemo(() => {
    if (esDevolucion) {
      return round2(
        detalleFactura.reduce((acc, d) => {
          const sel = seleccion[d.id_detalle];
          return acc + (sel?.checked ? importeDevolucion(sel) : 0);
        }, 0)
      );
    }
    return round2(lineas.reduce((acc, l) => acc + importeConcepto(l), 0));
  }, [esDevolucion, detalleFactura, seleccion, lineas]);

  function validar() {
    const next = {};
    if (!asociado)
      next.id_comprobante_asociado = "Elegí la factura asociada.";
    if (!MOTIVOS.some((m) => m.value === motivo))
      next.motivo = "Elegí un motivo para la nota de crédito.";

    if (motivo) {
      if (esDevolucion) {
        const elegidas = detalleFactura.filter(
          (d) => seleccion[d.id_detalle]?.checked
        );
        if (elegidas.length === 0) {
          next.detalle = "Elegí al menos un producto a acreditar.";
        } else {
          const invalidas = elegidas.some((d) => {
            const sel = seleccion[d.id_detalle];
            const cant = Number(sel.cantidad) || 0;
            return cant <= 0 || cant > (Number(d.cantidad) || 0);
          });
          if (invalidas)
            next.detalle =
              "Cada línea elegida necesita una cantidad mayor a cero y no mayor a la de la factura.";
          else if (!(total > 0))
            next.detalle = "El importe total de la nota de crédito debe ser mayor a cero.";
        }
      } else {
        const validas = lineas.filter(
          (l) =>
            l.concepto.trim() &&
            (Number(l.importe) || 0) >= 0 &&
            (Number(l.impuesto) || 0) >= 0
        );
        if (validas.length !== lineas.length || lineas.length === 0)
          next.detalle = "Cada línea necesita un concepto e importes no negativos.";
        else if (!(total > 0))
          next.detalle = "El importe total de la nota de crédito debe ser mayor a cero.";
      }
    }

    setErrores(next);
    return Object.keys(next).length === 0;
  }

  function aplicarError(ui) {
    if (ui.field && CAMPOS_CABECERA.includes(ui.field)) {
      setErrorCabecera(ui.field, ui.message);
    } else if (ui.field === "motivo" || ui.field === "id_comprobante_asociado") {
      setErrores((prev) => ({ ...prev, [ui.field]: ui.message }));
    } else if (ui.field === "detalle" || ui.field === "importe") {
      setErrores((prev) => ({ ...prev, detalle: ui.message }));
    } else {
      setErrorServer(ui.message);
    }
    if (ui.reload) router.refresh();
  }

  function armarDetalle() {
    if (esDevolucion) {
      return detalleFactura
        .filter((d) => seleccion[d.id_detalle]?.checked)
        .map((d) => {
          const sel = seleccion[d.id_detalle];
          return {
            id_producto: d.id_producto,
            id_detalle_origen: d.id_detalle,
            cantidad: sel.cantidad,
            precio_unitario: sel.precio_unitario,
            importe: importeDevolucion(sel),
            impuesto: 0,
          };
        });
    }
    return lineas.map((l) => ({
      concepto: l.concepto,
      importe: l.importe || 0,
      impuesto: l.impuesto || 0,
    }));
  }

  function registrar() {
    setErrorServer(null);
    const okCab = validarCabecera();
    const okLocal = validar();
    if (!okCab || !okLocal) return;

    startTransition(async () => {
      const result = await registrarNotaCredito({
        id_proveedor: cab.id_proveedor,
        id_tipo_comprobante: cab.id_tipo_comprobante,
        punto_venta: cab.punto_venta,
        numero: cab.numero,
        fecha_comprobante: cab.fecha_comprobante,
        id_comprobante_asociado: asociado,
        motivo,
        observaciones: cab.observaciones || null,
        detalle: armarDetalle(),
      });

      if (!result.ok) {
        aplicarError(mapErrorComprobante(result));
        return;
      }

      router.push("/compras/comprobantes");
      router.refresh();
    });
  }

  return (
    <div className="palacio-card mt-6 overflow-hidden">
      <div className="border-b border-palacio-border px-5 py-4">
        <h2 className="mb-4 text-sm font-semibold text-zinc-900">
          Datos de la nota de crédito
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <FacturaAsociadaSelect
            label="Factura asociada"
            requerido
            error={errores.id_comprobante_asociado}
            idProveedor={cab.id_proveedor}
            facturas={facturas}
            value={asociado}
            onChange={(v) => {
              setAsociado(v);
              limpiar("id_comprobante_asociado");
              limpiar("detalle");
              if (esDevolucion && v) cargarDetalleFactura(v);
              else limpiarDetalleFactura();
            }}
          />
          <Campo label="Motivo" error={errores.motivo} requerido>
            <select
              value={motivo}
              onChange={(e) => {
                const v = e.target.value;
                setMotivo(v);
                limpiar("motivo");
                limpiar("detalle");
                if (v === "devolucion_mercaderia" && asociado)
                  cargarDetalleFactura(asociado);
                else limpiarDetalleFactura();
              }}
              className="palacio-input"
            >
              <option value="">Seleccioná un motivo…</option>
              {MOTIVOS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </Campo>
        </div>
      </div>

      {!motivo ? (
        <p className="px-5 py-4 text-sm text-palacio-muted">
          Elegí una factura asociada y un motivo para cargar las líneas a
          acreditar.
        </p>
      ) : esDevolucion ? (
        <>
          <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
            <h3 className="text-sm font-semibold text-zinc-900">
              Productos a acreditar
            </h3>
          </div>

          {!asociado ? (
            <p className="px-5 py-4 text-sm text-palacio-muted">
              Elegí la factura asociada para ver sus productos.
            </p>
          ) : cargandoDetalle ? (
            <p className="px-5 py-4 text-sm text-palacio-muted">
              Cargando el detalle de la factura…
            </p>
          ) : errorDetalleFactura ? (
            <p className="mx-5 my-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorDetalleFactura}
            </p>
          ) : detalleFactura.length === 0 ? (
            <p className="px-5 py-4 text-sm text-palacio-muted">
              La factura asociada no tiene líneas de producto para acreditar.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-palacio-border bg-zinc-50/80">
                    <Th className="w-12" />
                    <Th>Producto</Th>
                    <Th className="w-28 text-right">Cant. factura</Th>
                    <Th className="w-28 text-right">Precio unit.</Th>
                    <Th className="w-32 text-right">Cant. a acreditar</Th>
                    <Th className="w-32 text-right">Importe</Th>
                  </tr>
                </thead>
                <tbody>
                  {detalleFactura.map((d) => {
                    const sel = seleccion[d.id_detalle] || {};
                    return (
                      <tr
                        key={d.id_detalle}
                        className="border-b border-palacio-border last:border-0"
                      >
                        <td className="px-3 py-2 align-middle">
                          <input
                            type="checkbox"
                            checked={Boolean(sel.checked)}
                            onChange={(e) =>
                              setSeleccionLinea(d.id_detalle, {
                                checked: e.target.checked,
                              })
                            }
                          />
                        </td>
                        <td className="px-3 py-2 align-middle text-zinc-800">
                          {d.nombre_producto || d.descripcion || "—"}
                        </td>
                        <td className="px-3 py-2 text-right align-middle tabular-nums text-palacio-muted">
                          {Number(d.cantidad) || 0}
                        </td>
                        <td className="px-3 py-2 text-right align-middle tabular-nums text-palacio-muted">
                          {monedaFmt.format(Number(d.precio_unitario) || 0)}
                        </td>
                        <td className="px-3 py-2 text-right align-middle">
                          <input
                            type="number"
                            min="0"
                            max={Number(d.cantidad) || 0}
                            step="0.001"
                            value={sel.cantidad ?? ""}
                            disabled={!sel.checked}
                            onChange={(e) =>
                              setSeleccionLinea(d.id_detalle, {
                                cantidad: e.target.value,
                              })
                            }
                            className="palacio-input text-right"
                          />
                        </td>
                        <td className="px-3 py-2 text-right align-middle font-medium text-zinc-800 tabular-nums">
                          {monedaFmt.format(
                            sel.checked ? importeDevolucion(sel) : 0
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-start justify-end border-t border-palacio-border px-5 py-3">
            <dl className="min-w-52 space-y-1 text-right text-sm">
              <div className="flex justify-between gap-6 border-t border-palacio-border pt-1 font-semibold text-zinc-900">
                <dt>Importe total</dt>
                <dd className="tabular-nums">{monedaFmt.format(total)}</dd>
              </div>
            </dl>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
            <h3 className="text-sm font-semibold text-zinc-900">Conceptos</h3>
            <span className="text-xs text-palacio-muted">
              {lineas.length} línea{lineas.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-palacio-border bg-zinc-50/80">
                  <Th>Concepto</Th>
                  <Th className="w-32 text-right">Importe</Th>
                  <Th className="w-32 text-right">Impuesto</Th>
                  <Th className="w-32 text-right">Total</Th>
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
                      <input
                        type="text"
                        value={l.concepto}
                        onChange={(e) =>
                          setLineaConcepto(idx, { concepto: e.target.value })
                        }
                        className="palacio-input"
                        placeholder="Bonificación, ajuste, diferencia…"
                        maxLength={200}
                      />
                    </td>
                    <td className="px-3 py-2 text-right align-top">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={l.importe}
                        onChange={(e) =>
                          setLineaConcepto(idx, { importe: e.target.value })
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
                          setLineaConcepto(idx, { impuesto: e.target.value })
                        }
                        className="palacio-input text-right"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="px-3 py-2 text-right align-middle font-medium text-zinc-800">
                      {monedaFmt.format(importeConcepto(l))}
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
              <div className="flex justify-between gap-6 border-t border-palacio-border pt-1 font-semibold text-zinc-900">
                <dt>Importe total</dt>
                <dd className="tabular-nums">{monedaFmt.format(total)}</dd>
              </div>
            </dl>
          </div>
        </>
      )}

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
          {pending ? "Registrando…" : "Registrar nota de crédito"}
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
  );
}
