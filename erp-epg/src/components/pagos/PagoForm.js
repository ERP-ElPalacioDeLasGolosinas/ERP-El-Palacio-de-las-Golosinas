"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { listarCuentasCompatibles } from "@/lib/medios-pago/actions";
import { registrarPago } from "@/lib/pagos/actions";
import { mapErrorPago } from "@/lib/pagos/errores";

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
  const d = new Date(String(valor).length <= 10 ? `${valor}T00:00:00` : valor);
  return Number.isNaN(d.getTime()) ? "—" : fechaFmt.format(d);
}

const redondear = (n) => Math.round((Number(n) || 0) * 100) / 100;

const TIPOS_CHEQUE = new Set(["Cheque propio", "Cheque de terceros"]);
const esTipoCheque = (tipo) => TIPOS_CHEQUE.has(tipo);

function chequeVacio(base = {}) {
  return {
    numero: base.numero ?? "",
    banco: base.banco ?? "",
    cuenta: base.cuenta ?? "",
    fecha_emision: base.fecha_emision ?? "",
    fecha_pago: base.fecha_pago ?? "",
  };
}

let contadorMedio = 0;
function nuevaLineaMedio(base = {}) {
  contadorMedio += 1;
  return {
    key: `m${contadorMedio}`,
    id_medio_pago: base.id_medio_pago ?? "",
    id_cuenta_tesoreria: base.id_cuenta_tesoreria ?? "",
    importe: base.importe != null ? String(base.importe) : "",
    referencia: base.referencia ?? "",
    cheque: chequeVacio(base.cheque),
    cuentas: [],
    cargandoCuentas: Boolean(base.id_medio_pago),
  };
}

/**
 * T-08 · Registro de un pago desde una orden de pago. Entra con la orden ya
 * cargada (`fn_orden_pago_obtener`): pre-rellena aplicaciones y medios desde
 * la orden, ambos editables. Secuencia por línea de medio: medio → cuenta
 * compatible. Si el total aplicado difiere del de la orden, pide confirmar la
 * diferencia (patrón `CMP10` / `PAG05`).
 *
 * @param {{
 *   orden: { id_orden_pago: string, nombre_proveedor: string, importe_total: number, estado: string },
 *   comprobantes: Array<Record<string, any>>,
 *   mediosOrden: Array<Record<string, any>>,
 *   medios: Array<{ id_medio_pago: string, nombre_medio_pago: string, tipo: string, requiere_referencia: boolean }>,
 * }} props
 */
export function PagoForm({ orden, comprobantes, mediosOrden, medios }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [fechaPago, setFechaPago] = useState(
    () => new Date().toISOString().slice(0, 10)
  );

  /** @type {[Record<string, { checked: boolean, importe: string }>, Function]} */
  const [aplicaciones, setAplicaciones] = useState(() => {
    const inicial = {};
    for (const c of comprobantes) {
      inicial[c.id_comprobante] = {
        checked: true,
        importe: String(
          redondear(
            Math.min(
              Number(c.importe_imputado) || 0,
              Number(c.saldo_pendiente) || 0
            )
          )
        ),
      };
    }
    return inicial;
  });

  const [lineasMedios, setLineasMedios] = useState(() =>
    (mediosOrden.length > 0 ? mediosOrden : [{}]).map((m) =>
      nuevaLineaMedio({
        id_medio_pago: m.id_medio_pago,
        id_cuenta_tesoreria: m.id_cuenta_tesoreria,
        importe: m.importe,
        referencia: m.referencia,
      })
    )
  );

  const [confirmarDif, setConfirmarDif] = useState(false);
  const [errores, setErrores] = useState({});
  const [errorServer, setErrorServer] = useState(null);

  // Carga inicial de cuentas compatibles para cada línea pre-rellenada.
  useEffect(() => {
    lineasMedios.forEach((l, idx) => {
      if (l.id_medio_pago && l.cargandoCuentas) {
        cargarCuentas(idx, l.id_medio_pago, l.id_cuenta_tesoreria);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function limpiarErrores() {
    setErrores({});
    setErrorServer(null);
  }

  function cargarCuentas(idx, idMedio, mantenerCuenta = "") {
    startTransition(async () => {
      const res = await listarCuentasCompatibles(idMedio);
      setLineasMedios((prev) =>
        prev.map((l, i) =>
          i === idx
            ? {
                ...l,
                cuentas: res.data ?? [],
                cargandoCuentas: false,
                id_cuenta_tesoreria: (res.data ?? []).some(
                  (c) => c.id_cuenta === mantenerCuenta
                )
                  ? mantenerCuenta
                  : "",
              }
            : l
        )
      );
    });
  }

  function setLineaMedio(idx, cambios) {
    setLineasMedios((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, ...cambios } : l))
    );
    limpiarErrores();
  }

  function setLineaCheque(idx, cambios) {
    setLineasMedios((prev) =>
      prev.map((l, i) =>
        i === idx ? { ...l, cheque: { ...l.cheque, ...cambios } } : l
      )
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
    if (idMedio) cargarCuentas(idx, idMedio);
  }

  function agregarLineaMedio() {
    setLineasMedios((prev) => [...prev, nuevaLineaMedio()]);
  }

  function quitarLineaMedio(idx) {
    setLineasMedios((prev) =>
      prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)
    );
  }

  function setImporteAplicado(idComprobante, importe) {
    setAplicaciones((prev) => ({
      ...prev,
      [idComprobante]: { checked: true, importe },
    }));
    limpiarErrores();
  }

  function toggleComprobante(idComprobante, checked) {
    setAplicaciones((prev) => ({
      ...prev,
      [idComprobante]: { ...prev[idComprobante], checked },
    }));
    limpiarErrores();
  }

  const seleccionadas = useMemo(
    () =>
      comprobantes
        .filter((c) => aplicaciones[c.id_comprobante]?.checked)
        .map((c) => ({
          comp: c,
          importe: Number(aplicaciones[c.id_comprobante]?.importe),
        })),
    [comprobantes, aplicaciones]
  );

  const totalAplicado = useMemo(
    () =>
      redondear(
        seleccionadas.reduce(
          (acc, s) => acc + (Number.isFinite(s.importe) ? s.importe : 0),
          0
        )
      ),
    [seleccionadas]
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

  const importeOrden = redondear(orden.importe_total);
  const diferenciaMedios = redondear(totalMedios - totalAplicado);
  const diferenciaOrden = redondear(totalAplicado - importeOrden);
  const hayDiferenciaOrden = diferenciaOrden !== 0;

  function medioDe(idMedio) {
    return medios.find((m) => m.id_medio_pago === idMedio) ?? null;
  }

  function validar() {
    const next = {};

    if (seleccionadas.length === 0)
      next.aplicaciones = "Marcá al menos un comprobante e indicá el importe.";
    for (const s of seleccionadas) {
      if (!(s.importe > 0)) {
        next.aplicaciones =
          "Cada comprobante aplicado necesita un importe mayor a cero.";
        break;
      }
      if (redondear(s.importe) > redondear(s.comp.saldo_pendiente)) {
        next.aplicaciones = `No podés aplicar más que el saldo de ${s.comp.numero_formateado} (${monedaFmt.format(
          Number(s.comp.saldo_pendiente) || 0
        )}).`;
        break;
      }
    }

    const lineasConDatos = lineasMedios.filter(
      (l) => l.id_medio_pago || l.id_cuenta_tesoreria || l.importe
    );
    if (lineasConDatos.length === 0) {
      next.medios = "Cargá al menos un medio de pago.";
    }
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
      if (
        esTipoCheque(m?.tipo) &&
        (!l.cheque.numero.trim() || !l.cheque.banco.trim())
      ) {
        next.medios = `El medio "${m.nombre_medio_pago}" es un cheque: cargá al menos número y banco.`;
        break;
      }
    }
    if (!next.medios && lineasConDatos.length > 0 && diferenciaMedios !== 0)
      next.medios = `La suma de los medios (${monedaFmt.format(
        totalMedios
      )}) no coincide con lo aplicado (${monedaFmt.format(totalAplicado)}).`;

    if (!next.aplicaciones && hayDiferenciaOrden && !confirmarDif)
      next.diferencia =
        "El total del pago no coincide con el de la orden. Confirmá la diferencia para continuar.";

    setErrores(next);
    return Object.keys(next).length === 0;
  }

  function enviar() {
    setErrorServer(null);
    if (!validar()) return;

    const payload = {
      id_orden_pago: orden.id_orden_pago,
      fecha_pago: fechaPago || null,
      confirmar_diferencia: hayDiferenciaOrden ? confirmarDif : false,
      aplicaciones: seleccionadas.map((s) => ({
        id_comprobante: s.comp.id_comprobante,
        importe_aplicado: s.importe,
      })),
      medios: lineasMedios
        .filter(
          (l) => l.id_medio_pago && l.id_cuenta_tesoreria && Number(l.importe) > 0
        )
        .map((l) => {
          const entrada = {
            id_medio_pago: l.id_medio_pago,
            id_cuenta_tesoreria: l.id_cuenta_tesoreria,
            importe: Number(l.importe),
            referencia: l.referencia || null,
          };
          if (esTipoCheque(medioDe(l.id_medio_pago)?.tipo)) {
            entrada.cheque = {
              numero: l.cheque.numero.trim(),
              banco: l.cheque.banco.trim(),
              cuenta: l.cheque.cuenta.trim() || null,
              fecha_emision: l.cheque.fecha_emision || null,
              fecha_pago: l.cheque.fecha_pago || null,
              importe: Number(l.importe),
            };
          }
          return entrada;
        }),
    };

    startTransition(async () => {
      const result = await registrarPago(payload);
      if (!result.ok) {
        const ui = mapErrorPago(result);
        if (ui.field) setErrores((prev) => ({ ...prev, [ui.field]: ui.message }));
        else setErrorServer(ui.message);
        if (ui.reload) router.refresh();
        return;
      }
      router.push(
        result.id
          ? `/tesoreria/pagos/${result.id}`
          : "/tesoreria/pagos"
      );
      router.refresh();
    });
  }

  return (
    <>
      {/* Cabecera */}
      <div className="palacio-card p-5 md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-900">
            Pago de la orden · {orden.nombre_proveedor}
          </h2>
          <span className="text-xs text-palacio-muted">
            Importe de la orden: {monedaFmt.format(importeOrden)}
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-800">
              Fecha del pago <span className="text-palacio-red">*</span>
            </label>
            <input
              type="date"
              value={fechaPago}
              onChange={(e) => setFechaPago(e.target.value)}
              className="palacio-input"
            />
          </div>
        </div>
      </div>

      {/* Aplicaciones */}
      <div className="palacio-card mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">
            Comprobantes a cancelar
          </h2>
          <span className="text-xs text-palacio-muted">
            {comprobantes.length} imputado{comprobantes.length === 1 ? "" : "s"}{" "}
            en la orden
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-palacio-border bg-zinc-50/80">
                <Th className="w-10" />
                <Th>Comprobante</Th>
                <Th>Vencimiento</Th>
                <Th className="text-right">Saldo actual</Th>
                <Th className="text-right">Imputado</Th>
                <Th className="w-40 text-right">A aplicar</Th>
              </tr>
            </thead>
            <tbody>
              {comprobantes.map((c) => {
                const sel = aplicaciones[c.id_comprobante];
                return (
                  <tr
                    key={c.id_comprobante}
                    className="border-b border-palacio-border last:border-0"
                  >
                    <td className="px-5 py-3 align-middle">
                      <input
                        type="checkbox"
                        checked={Boolean(sel?.checked)}
                        onChange={(e) =>
                          toggleComprobante(c.id_comprobante, e.target.checked)
                        }
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
                    <td className="px-5 py-3 text-right align-middle text-palacio-muted">
                      {monedaFmt.format(Number(c.importe_imputado) || 0)}
                    </td>
                    <td className="px-5 py-3 text-right align-middle">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        disabled={!sel?.checked}
                        value={sel?.checked ? sel.importe : ""}
                        onChange={(e) =>
                          setImporteAplicado(c.id_comprobante, e.target.value)
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

        {errores.aplicaciones ? (
          <p className="mx-5 my-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errores.aplicaciones}
          </p>
        ) : null}

        <div className="border-t border-palacio-border px-5 py-3 text-right text-sm">
          <span className="text-palacio-muted">Total aplicado: </span>
          <span className="font-semibold text-zinc-900">
            {monedaFmt.format(totalAplicado)}
          </span>
        </div>
      </div>

      {/* Medios */}
      <div className="palacio-card mt-6 overflow-hidden">
        <div className="border-b border-palacio-border px-5 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">Medios de pago</h2>
        </div>

        <div className="space-y-3 p-4">
          {lineasMedios.map((l, idx) => {
            const m = medioDe(l.id_medio_pago);
            return (
              <div
                key={l.key}
                className="space-y-3 rounded-lg border border-palacio-border p-3"
              >
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_9rem_1fr_auto]">
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
                  onChange={(e) =>
                    setLineaMedio(idx, { referencia: e.target.value })
                  }
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

                {esTipoCheque(m?.tipo) ? (
                  <div className="rounded-lg border border-palacio-border bg-zinc-50/60 p-3">
                    <p className="mb-2 text-xs font-semibold tracking-wide text-palacio-muted uppercase">
                      Datos del cheque
                    </p>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                      <input
                        type="text"
                        value={l.cheque.numero}
                        onChange={(e) =>
                          setLineaCheque(idx, { numero: e.target.value })
                        }
                        className="palacio-input"
                        maxLength={40}
                        placeholder="Número *"
                      />
                      <input
                        type="text"
                        value={l.cheque.banco}
                        onChange={(e) =>
                          setLineaCheque(idx, { banco: e.target.value })
                        }
                        className="palacio-input"
                        maxLength={80}
                        placeholder="Banco *"
                      />
                      <input
                        type="text"
                        value={l.cheque.cuenta}
                        onChange={(e) =>
                          setLineaCheque(idx, { cuenta: e.target.value })
                        }
                        className="palacio-input"
                        maxLength={40}
                        placeholder="Cuenta"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex flex-col gap-1 text-xs text-palacio-muted">
                          Emisión
                          <input
                            type="date"
                            value={l.cheque.fecha_emision}
                            onChange={(e) =>
                              setLineaCheque(idx, {
                                fecha_emision: e.target.value,
                              })
                            }
                            className="palacio-input"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-palacio-muted">
                          Cobro / pago
                          <input
                            type="date"
                            value={l.cheque.fecha_pago}
                            onChange={(e) =>
                              setLineaCheque(idx, { fecha_pago: e.target.value })
                            }
                            className="palacio-input"
                          />
                        </label>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-palacio-muted">
                      El importe del cheque es el de la línea:{" "}
                      {monedaFmt.format(Number(l.importe) || 0)}.
                    </p>
                  </div>
                ) : null}
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
            {diferenciaMedios !== 0 ? (
              <p className="text-amber-700">
                Diferencia con lo aplicado: {monedaFmt.format(diferenciaMedios)}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Diferencia con la orden */}
      {hayDiferenciaOrden ? (
        <div className="palacio-card mt-6 border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-medium">
            El total del pago ({monedaFmt.format(totalAplicado)}) difiere del de
            la orden ({monedaFmt.format(importeOrden)}) en{" "}
            {monedaFmt.format(diferenciaOrden)}.
          </p>
          <label className="mt-2 flex items-center gap-2">
            <input
              type="checkbox"
              checked={confirmarDif}
              onChange={(e) => setConfirmarDif(e.target.checked)}
              className="size-4 accent-palacio-red"
            />
            Confirmar la diferencia y registrar el pago igual.
          </label>
          {errores.diferencia ? (
            <p className="mt-2 text-red-700">{errores.diferencia}</p>
          ) : null}
        </div>
      ) : null}

      {errorServer ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorServer}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={enviar}
          disabled={
            pending ||
            totalAplicado <= 0 ||
            diferenciaMedios !== 0 ||
            (hayDiferenciaOrden && !confirmarDif)
          }
          className="palacio-btn-primary px-4 py-2.5 text-sm"
        >
          {pending ? "Registrando…" : "Confirmar pago"}
        </button>
        <button
          type="button"
          onClick={() =>
            router.push(`/tesoreria/ordenes-de-pago/${orden.id_orden_pago}`)
          }
          disabled={pending}
          className="palacio-btn-secondary px-4 py-2.5 text-sm"
        >
          Volver a la orden
        </button>
      </div>
    </>
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
