"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registrarComprobante, validarDetalle } from "@/lib/comprobantes/actions";
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
  };
}

/**
 * C-05 · Alta de comprobante de proveedor: cabecera + grilla de líneas en una
 * sola pantalla, enviadas juntas a `fn_comprobante_registrar` (D-011).
 *
 * @param {{
 *   proveedores: Array<{ id_proveedor: string, nombre_proveedor: string }>,
 *   tipos: Array<{ id_tipo_comprobante: string, nombre_tipo_comprobante: string, letra: string | null, signo: number }>,
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
    importe_total: "",
    observaciones: "",
  });
  const [lineas, setLineas] = useState([nuevaLinea()]);
  const [errores, setErrores] = useState({});
  const [errorServer, setErrorServer] = useState(null);
  const [confirmarDiferencia, setConfirmarDiferencia] = useState(false);
  const [permiteConfirmar, setPermiteConfirmar] = useState(false);

  const tipoSel = tipos.find(
    (t) => t.id_tipo_comprobante === cab.id_tipo_comprobante
  );

  function setCampo(campo, valor) {
    setCab((prev) => ({ ...prev, [campo]: valor }));
    setErrores((prev) => ({ ...prev, [campo]: null }));
    setErrorServer(null);
    // Cualquier cambio invalida una confirmación de diferencia previa.
    setPermiteConfirmar(false);
    setConfirmarDiferencia(false);
  }

  function setLinea(idx, cambios) {
    setLineas((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, ...cambios } : l))
    );
    setErrores((prev) => ({ ...prev, detalle: null }));
    setErrorServer(null);
    setPermiteConfirmar(false);
    setConfirmarDiferencia(false);
  }

  function agregarLinea() {
    setLineas((prev) => [...prev, nuevaLinea()]);
  }

  function quitarLinea(idx) {
    setLineas((prev) =>
      prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)
    );
  }

  const totalDetalle = useMemo(
    () =>
      lineas.reduce((acc, l) => {
        const c = Number(l.cantidad);
        const p = Number(l.precio_unitario);
        if (!Number.isFinite(c) || !Number.isFinite(p)) return acc;
        return acc + c * p;
      }, 0),
    [lineas]
  );

  const importeTotalNum = Number(cab.importe_total);
  const diferencia =
    Number.isFinite(importeTotalNum) && cab.importe_total !== ""
      ? Math.round((importeTotalNum - totalDetalle) * 100) / 100
      : null;
  const hayDiferencia = diferencia != null && diferencia !== 0;

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
    if (!(Number(cab.importe_total) > 0))
      next.importe = "El importe total debe ser mayor a cero.";

    const lineasValidas = lineas.filter((l) => {
      const tieneItem =
        l.modo === "producto" ? Boolean(l.id_producto) : Boolean(l.concepto.trim());
      return tieneItem && Number(l.cantidad) > 0 && Number(l.precio_unitario) >= 0;
    });
    if (lineasValidas.length !== lineas.length || lineas.length === 0)
      next.detalle =
        "Cada línea necesita artículo o concepto, cantidad mayor a cero y precio no negativo.";

    setErrores(next);
    return Object.keys(next).length === 0;
  }

  function registrar() {
    setErrorServer(null);
    if (!validar()) return;

    startTransition(async () => {
      // C-11: la advertencia de diferencia se resuelve antes de confirmar,
      // contra fn_comprobante_detalle_validar. CMP10 queda como respaldo.
      const val = await validarDetalle({
        detalle: lineas.map((l) => ({
          cantidad: l.cantidad,
          precio_unitario: l.precio_unitario,
        })),
        importe_total: cab.importe_total,
      });

      if (val.error) {
        setErrorServer(val.error);
        return;
      }

      if (!val.data.coincide && !confirmarDiferencia) {
        setPermiteConfirmar(true);
        setErrorServer(
          `La suma del detalle (${monedaFmt.format(
            val.data.total_detalle
          )}) no coincide con el importe total (${monedaFmt.format(
            Number(cab.importe_total) || 0
          )}). Revisá los valores o confirmá la diferencia para continuar.`
        );
        return;
      }

      const result = await registrarComprobante({
        id_proveedor: cab.id_proveedor,
        id_tipo_comprobante: cab.id_tipo_comprobante,
        punto_venta: cab.punto_venta,
        numero: cab.numero,
        fecha_comprobante: cab.fecha_comprobante,
        fecha_vencimiento: cab.fecha_vencimiento || null,
        importe_total: cab.importe_total,
        observaciones: cab.observaciones || null,
        confirmar_diferencia: confirmarDiferencia,
        detalle: lineas.map((l) => ({
          id_producto: l.modo === "producto" ? l.id_producto : null,
          concepto: l.modo === "concepto" ? l.concepto : null,
          cantidad: l.cantidad,
          precio_unitario: l.precio_unitario,
        })),
      });

      if (!result.ok) {
        const ui = mapErrorComprobante(result);
        if (ui.confirmable) {
          setPermiteConfirmar(true);
        }
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
            {tipoSel ? (
              <p className="text-xs text-palacio-muted">
                {tipoSel.signo === -1
                  ? "Resta del saldo del proveedor (nota de crédito)."
                  : "Suma al saldo del proveedor."}
              </p>
            ) : null}
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

          <Campo label="Importe total" error={errores.importe} requerido>
            <input
              type="number"
              min="0"
              step="0.01"
              value={cab.importe_total}
              onChange={(e) => setCampo("importe_total", e.target.value)}
              className="palacio-input"
              placeholder="0.00"
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
                <Th className="w-28 text-right">Cantidad</Th>
                <Th className="w-32 text-right">Precio unit.</Th>
                <Th className="w-32 text-right">Importe</Th>
                <Th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {lineas.map((l, idx) => {
                const importe =
                  (Number(l.cantidad) || 0) * (Number(l.precio_unitario) || 0);
                return (
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
                    <td className="px-3 py-2 text-right align-middle font-medium text-zinc-800">
                      {monedaFmt.format(Number.isFinite(importe) ? importe : 0)}
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
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-palacio-border px-5 py-3">
          <button
            type="button"
            onClick={agregarLinea}
            className="palacio-btn-secondary px-3 py-2 text-sm"
          >
            Agregar línea
          </button>
          <div className="text-right text-sm">
            <p className="text-palacio-muted">
              Suma del detalle:{" "}
              <span className="font-semibold text-zinc-900">
                {monedaFmt.format(totalDetalle)}
              </span>
            </p>
            {hayDiferencia ? (
              <p className="text-amber-700">
                Diferencia con el importe total:{" "}
                {monedaFmt.format(diferencia)}
              </p>
            ) : null}
          </div>
        </div>

        {errores.detalle ? (
          <p className="mx-5 mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errores.detalle}
          </p>
        ) : null}

        {permiteConfirmar && hayDiferencia ? (
          <label className="mx-5 mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <input
              type="checkbox"
              checked={confirmarDiferencia}
              onChange={(e) => {
                setConfirmarDiferencia(e.target.checked);
                if (e.target.checked) setErrorServer(null);
              }}
              className="size-4 accent-palacio-red"
            />
            Registrar de todos modos, aceptando la diferencia entre el detalle y
            el importe total.
          </label>
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
            disabled={pending || (permiteConfirmar && hayDiferencia && !confirmarDiferencia)}
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
