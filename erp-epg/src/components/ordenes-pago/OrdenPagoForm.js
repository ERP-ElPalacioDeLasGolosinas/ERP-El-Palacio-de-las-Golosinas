"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  listarComprobantesPendientes,
  obtenerResumenPendientes,
} from "@/lib/comprobantes/actions";
import { listarCuentasCompatibles } from "@/lib/medios-pago/actions";
import { crearOrdenPago } from "@/lib/ordenes-pago/actions";
import { mapErrorOrdenPago } from "@/lib/ordenes-pago/errores";

const monedaFmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});
const fechaFmt = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatFecha(valor) {
  if (!valor) return "—";
  const d = new Date(`${valor}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "—" : fechaFmt.format(d);
}

const redondear = (n) => Math.round((Number(n) || 0) * 100) / 100;

let contadorMedio = 0;
function nuevaLineaMedio() {
  contadorMedio += 1;
  return {
    key: `m${contadorMedio}`,
    id_medio_pago: "",
    id_cuenta_tesoreria: "",
    importe: "",
    referencia: "",
    cuentas: [],
    cargandoCuentas: false,
  };
}

/**
 * T-07 · Alta de una orden de pago con el patrón "carrito": elegir proveedor →
 * imputar sus comprobantes pendientes → cargar los medios de pago (primero el
 * medio, después la cuenta compatible). Guardar como borrador o confirmar.
 *
 * @param {{
 *   proveedores: Array<{ id_proveedor: string, nombre_proveedor: string }>,
 *   medios: Array<{ id_medio_pago: string, nombre_medio_pago: string, tipo: string, requiere_referencia: boolean }>,
 * }} props
 */
export function OrdenPagoForm({ proveedores, medios }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [cargandoPend, startCargaPendientes] = useTransition();

  const [idProveedor, setIdProveedor] = useState("");
  const [pendientes, setPendientes] = useState([]);
  const [resumenPend, setResumenPend] = useState(null);
  /** @type {[Record<string, { checked: boolean, importe: string }>, Function]} */
  const [imputaciones, setImputaciones] = useState({});
  const [lineasMedios, setLineasMedios] = useState([nuevaLineaMedio()]);
  const [cab, setCab] = useState({
    fecha_prevista: "",
    referencia: "",
    observaciones: "",
  });
  const [errores, setErrores] = useState({});
  const [errorServer, setErrorServer] = useState(null);

  function limpiarErrores() {
    setErrores({});
    setErrorServer(null);
  }

  function elegirProveedor(id) {
    setIdProveedor(id);
    setPendientes([]);
    setResumenPend(null);
    setImputaciones({});
    setLineasMedios([nuevaLineaMedio()]);
    limpiarErrores();
    if (!id) return;

    startCargaPendientes(async () => {
      const [lista, resumen] = await Promise.all([
        listarComprobantesPendientes(id, "vencimiento"),
        obtenerResumenPendientes(id),
      ]);
      if (lista.error) {
        setErrorServer(lista.error);
        return;
      }
      setPendientes(lista.data ?? []);
      setResumenPend(resumen.data ?? null);
    });
  }

  function toggleComprobante(comp, checked) {
    setImputaciones((prev) => ({
      ...prev,
      [comp.id_comprobante]: {
        checked,
        importe:
          prev[comp.id_comprobante]?.importe ??
          String(redondear(comp.saldo_pendiente)),
      },
    }));
    limpiarErrores();
  }

  function setImporteImputado(idComprobante, importe) {
    setImputaciones((prev) => ({
      ...prev,
      [idComprobante]: { checked: true, importe },
    }));
    limpiarErrores();
  }

  function setLineaMedio(idx, cambios) {
    setLineasMedios((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, ...cambios } : l))
    );
    limpiarErrores();
  }

  function elegirMedio(idx, idMedio) {
    setLineaMedio(idx, {
      id_medio_pago: idMedio,
      id_cuenta_tesoreria: "",
      cuentas: [],
      cargandoCuentas: Boolean(idMedio),
    });
    if (!idMedio) return;

    startTransition(async () => {
      const res = await listarCuentasCompatibles(idMedio);
      setLineasMedios((prev) =>
        prev.map((l, i) =>
          i === idx
            ? {
                ...l,
                cuentas: res.data ?? [],
                cargandoCuentas: false,
              }
            : l
        )
      );
    });
  }

  function agregarLineaMedio() {
    setLineasMedios((prev) => [...prev, nuevaLineaMedio()]);
  }

  function quitarLineaMedio(idx) {
    setLineasMedios((prev) =>
      prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)
    );
  }

  const seleccionadas = useMemo(
    () =>
      pendientes
        .filter((c) => imputaciones[c.id_comprobante]?.checked)
        .map((c) => ({
          comp: c,
          importe: Number(imputaciones[c.id_comprobante]?.importe),
        })),
    [pendientes, imputaciones]
  );

  const totalImputado = useMemo(
    () =>
      redondear(
        seleccionadas.reduce(
          (acc, s) => acc + (Number.isFinite(s.importe) ? s.importe : 0),
          0
        )
      ),
    [seleccionadas]
  );

  const mediosCargados = useMemo(
    () => lineasMedios.filter((l) => l.id_medio_pago && l.id_cuenta_tesoreria),
    [lineasMedios]
  );

  const totalMedios = useMemo(
    () =>
      redondear(
        lineasMedios.reduce((acc, l) => {
          const n = Number(l.importe);
          return acc + (Number.isFinite(n) ? n : 0);
        }, 0)
      ),
    [lineasMedios]
  );

  const diferencia = redondear(totalMedios - totalImputado);
  const mediosCoinciden = mediosCargados.length > 0 && diferencia === 0;

  function medioDe(idMedio) {
    return medios.find((m) => m.id_medio_pago === idMedio) ?? null;
  }

  function validar({ conMedios }) {
    const next = {};
    if (!idProveedor) next.proveedor = "Elegí un proveedor.";
    if (seleccionadas.length === 0)
      next.comprobantes = "Marcá al menos un comprobante e indicá el importe.";
    for (const s of seleccionadas) {
      if (!(s.importe > 0)) {
        next.comprobantes = "Cada comprobante imputado necesita un importe mayor a cero.";
        break;
      }
      if (redondear(s.importe) > redondear(s.comp.saldo_pendiente)) {
        next.comprobantes = `No podés imputar más que el saldo de ${s.comp.numero_formateado} (${monedaFmt.format(
          Number(s.comp.saldo_pendiente) || 0
        )}).`;
        break;
      }
    }

    const lineasConDatos = lineasMedios.filter(
      (l) => l.id_medio_pago || l.id_cuenta_tesoreria || l.importe
    );
    if (conMedios || lineasConDatos.length > 0) {
      if (conMedios && mediosCargados.length === 0)
        next.medios = "Cargá al menos un medio de pago para confirmar.";
      for (const l of lineasConDatos) {
        if (!l.id_medio_pago || !l.id_cuenta_tesoreria || !(Number(l.importe) > 0)) {
          next.medios =
            "Cada línea de pago necesita medio, cuenta e importe mayor a cero.";
          break;
        }
        const m = medioDe(l.id_medio_pago);
        if (m?.requiere_referencia && !l.referencia.trim()) {
          next.medios = `El medio "${m.nombre_medio_pago}" requiere una referencia.`;
          break;
        }
      }
      if (!next.medios && lineasConDatos.length > 0 && diferencia !== 0)
        next.medios = `La suma de los medios (${monedaFmt.format(
          totalMedios
        )}) no coincide con lo imputado (${monedaFmt.format(totalImputado)}).`;
    }

    setErrores(next);
    return Object.keys(next).length === 0;
  }

  function enviar(confirmar) {
    setErrorServer(null);
    if (!validar({ conMedios: confirmar })) return;

    const payload = {
      id_proveedor: idProveedor,
      fecha_prevista: cab.fecha_prevista || null,
      referencia: cab.referencia || null,
      observaciones: cab.observaciones || null,
      confirmar,
      imputaciones: seleccionadas.map((s) => ({
        id_comprobante: s.comp.id_comprobante,
        importe_imputado: s.importe,
      })),
      medios: lineasMedios
        .filter((l) => l.id_medio_pago && l.id_cuenta_tesoreria && Number(l.importe) > 0)
        .map((l) => ({
          id_medio_pago: l.id_medio_pago,
          id_cuenta_tesoreria: l.id_cuenta_tesoreria,
          importe: Number(l.importe),
          referencia: l.referencia || null,
        })),
    };

    startTransition(async () => {
      const result = await crearOrdenPago(payload);
      if (!result.ok) {
        const ui = mapErrorOrdenPago(result);
        if (ui.field) setErrores((prev) => ({ ...prev, [ui.field]: ui.message }));
        else setErrorServer(ui.message);
        if (ui.reload) router.refresh();
        return;
      }
      router.push(
        result.id
          ? `/tesoreria/ordenes-de-pago/${result.id}`
          : "/tesoreria/ordenes-de-pago"
      );
      router.refresh();
    });
  }

  return (
    <>
      {/* Paso 1 · Proveedor + cabecera */}
      <div className="palacio-card p-5 md:p-6">
        <h2 className="mb-4 text-sm font-semibold text-zinc-900">
          Proveedor y datos de la orden
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Campo label="Proveedor" error={errores.proveedor} requerido>
            <select
              value={idProveedor}
              onChange={(e) => elegirProveedor(e.target.value)}
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
          <Campo label="Fecha prevista de pago (opcional)">
            <input
              type="date"
              value={cab.fecha_prevista}
              onChange={(e) => setCab((p) => ({ ...p, fecha_prevista: e.target.value }))}
              className="palacio-input"
            />
          </Campo>
          <Campo label="Referencia (opcional)">
            <input
              type="text"
              value={cab.referencia}
              onChange={(e) => setCab((p) => ({ ...p, referencia: e.target.value }))}
              className="palacio-input"
              maxLength={120}
              placeholder="N° de orden interna, lote…"
            />
          </Campo>
          <Campo label="Observaciones (opcional)" full>
            <textarea
              value={cab.observaciones}
              onChange={(e) => setCab((p) => ({ ...p, observaciones: e.target.value }))}
              rows={2}
              maxLength={500}
              className="palacio-input"
            />
          </Campo>
        </div>
      </div>

      {/* Paso 2 · Comprobantes a imputar */}
      <div className="palacio-card mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">
            Comprobantes pendientes
          </h2>
          {resumenPend ? (
            <span className="text-xs text-palacio-muted">
              {resumenPend.cantidad} pendiente
              {resumenPend.cantidad === 1 ? "" : "s"} ·{" "}
              {monedaFmt.format(resumenPend.saldo_pendiente)} de saldo
            </span>
          ) : null}
        </div>

        {!idProveedor ? (
          <p className="px-5 py-8 text-center text-sm text-palacio-muted">
            Elegí un proveedor para ver sus comprobantes con saldo pendiente.
          </p>
        ) : cargandoPend ? (
          <p className="px-5 py-8 text-center text-sm text-palacio-muted">
            Cargando comprobantes…
          </p>
        ) : pendientes.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-palacio-muted">
            Este proveedor no tiene comprobantes con saldo pendiente.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-palacio-border bg-zinc-50/80">
                  <Th className="w-10" />
                  <Th>Comprobante</Th>
                  <Th>Vencimiento</Th>
                  <Th className="text-right">Saldo</Th>
                  <Th className="w-40 text-right">Importe a imputar</Th>
                </tr>
              </thead>
              <tbody>
                {pendientes.map((c) => {
                  const sel = imputaciones[c.id_comprobante];
                  return (
                    <tr
                      key={c.id_comprobante}
                      className="border-b border-palacio-border last:border-0"
                    >
                      <td className="px-5 py-3 align-middle">
                        <input
                          type="checkbox"
                          checked={Boolean(sel?.checked)}
                          onChange={(e) => toggleComprobante(c, e.target.checked)}
                          className="size-4 accent-palacio-red"
                        />
                      </td>
                      <td className="px-5 py-3 align-middle">
                        <span className="font-mono text-xs text-zinc-700">
                          {c.numero_formateado}
                        </span>
                        <span className="ml-2 text-palacio-muted">
                          {c.nombre_tipo_comprobante}
                          {c.letra ? ` (${c.letra})` : ""}
                        </span>
                      </td>
                      <td className="px-5 py-3 align-middle text-palacio-muted">
                        {formatFecha(c.fecha_vencimiento)}
                      </td>
                      <td className="px-5 py-3 text-right align-middle text-palacio-muted">
                        {monedaFmt.format(Number(c.saldo_pendiente) || 0)}
                      </td>
                      <td className="px-5 py-3 text-right align-middle">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          disabled={!sel?.checked}
                          value={sel?.checked ? sel.importe : ""}
                          onChange={(e) =>
                            setImporteImputado(c.id_comprobante, e.target.value)
                          }
                          className="palacio-input w-36 text-right"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {errores.comprobantes ? (
          <p className="mx-5 my-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errores.comprobantes}
          </p>
        ) : null}

        <div className="border-t border-palacio-border px-5 py-3 text-right text-sm">
          <span className="text-palacio-muted">Total imputado: </span>
          <span className="font-semibold text-zinc-900">
            {monedaFmt.format(totalImputado)}
          </span>
        </div>
      </div>

      {/* Paso 3 · Medios de pago */}
      <div className="palacio-card mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">Medios de pago</h2>
          <span className="text-xs text-palacio-muted">
            opcional para guardar como borrador
          </span>
        </div>

        <div className="space-y-3 p-4">
          {lineasMedios.map((l, idx) => {
            const m = medioDe(l.id_medio_pago);
            return (
              <div
                key={l.key}
                className="grid gap-3 rounded-lg border border-palacio-border p-3 md:grid-cols-[1fr_1fr_9rem_1fr_auto]"
              >
                <select
                  value={l.id_medio_pago}
                  onChange={(e) => elegirMedio(idx, e.target.value)}
                  className="palacio-input"
                >
                  <option value="">Medio de pago…</option>
                  {medios.map((mp) => (
                    <option key={mp.id_medio_pago} value={mp.id_medio_pago}>
                      {mp.nombre_medio_pago}
                    </option>
                  ))}
                </select>

                <div>
                  <select
                    value={l.id_cuenta_tesoreria}
                    onChange={(e) =>
                      setLineaMedio(idx, { id_cuenta_tesoreria: e.target.value })
                    }
                    disabled={!l.id_medio_pago || l.cargandoCuentas}
                    className="palacio-input"
                  >
                    <option value="">
                      {l.cargandoCuentas ? "Cargando cuentas…" : "Cuenta…"}
                    </option>
                    {l.cuentas.map((c) => (
                      <option key={c.id_cuenta} value={c.id_cuenta}>
                        {c.nombre_cuenta} ({c.tipo})
                      </option>
                    ))}
                  </select>
                  {l.id_medio_pago && !l.cargandoCuentas && l.cuentas.length === 0 ? (
                    <p className="mt-1 text-xs text-amber-700">
                      Ese medio no tiene cuentas habilitadas. Configuralas en
                      Medios de pago.
                    </p>
                  ) : null}
                </div>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={l.importe}
                  onChange={(e) => setLineaMedio(idx, { importe: e.target.value })}
                  className="palacio-input text-right"
                  placeholder="Importe"
                />

                <input
                  type="text"
                  value={l.referencia}
                  onChange={(e) => setLineaMedio(idx, { referencia: e.target.value })}
                  className="palacio-input"
                  maxLength={120}
                  placeholder={
                    m?.requiere_referencia ? "Referencia (requerida)" : "Referencia"
                  }
                />

                <button
                  type="button"
                  onClick={() => quitarLineaMedio(idx)}
                  disabled={lineasMedios.length === 1}
                  className="palacio-action-btn palacio-action-danger self-center"
                >
                  Quitar
                </button>
              </div>
            );
          })}
        </div>

        {errores.medios ? (
          <p className="mx-5 mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errores.medios}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-palacio-border px-5 py-3">
          <button
            type="button"
            onClick={agregarLineaMedio}
            className="palacio-btn-secondary px-3 py-2 text-sm"
          >
            Agregar medio
          </button>
          <div className="text-right text-sm">
            <p className="text-palacio-muted">
              Total medios:{" "}
              <span className="font-semibold text-zinc-900">
                {monedaFmt.format(totalMedios)}
              </span>
            </p>
            {mediosCargados.length > 0 && diferencia !== 0 ? (
              <p className="text-amber-700">
                Diferencia con lo imputado: {monedaFmt.format(diferencia)}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {errorServer ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorServer}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => enviar(true)}
          disabled={pending || !mediosCoinciden || totalImputado <= 0}
          className="palacio-btn-primary px-4 py-2.5 text-sm"
        >
          {pending ? "Guardando…" : "Confirmar orden"}
        </button>
        <button
          type="button"
          onClick={() => enviar(false)}
          disabled={pending || totalImputado <= 0}
          className="palacio-btn-secondary px-4 py-2.5 text-sm"
        >
          Guardar borrador
        </button>
        <button
          type="button"
          onClick={() => router.push("/tesoreria/ordenes-de-pago")}
          disabled={pending}
          className="palacio-btn-secondary px-4 py-2.5 text-sm"
        >
          Cancelar
        </button>
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
      className={`px-5 py-3 text-[11px] font-semibold tracking-wider text-palacio-muted uppercase ${className}`}
    >
      {children}
    </th>
  );
}
