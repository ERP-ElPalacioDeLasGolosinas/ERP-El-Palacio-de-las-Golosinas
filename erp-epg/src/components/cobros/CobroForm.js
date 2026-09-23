"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { listarCuentasCompatibles } from "@/lib/medios-pago/actions";
import { registrarCobro } from "@/lib/cobros/actions";
import { mapErrorCobro } from "@/lib/cobros/errores";

const monedaFmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

const redondear = (n) => Math.round((Number(n) || 0) * 100) / 100;

let contadorMedio = 0;
function nuevaLineaMedio(base = {}) {
  contadorMedio += 1;
  return {
    key: `m${contadorMedio}`,
    id_medio_pago: "",
    id_cuenta_tesoreria: "",
    importe: base.importe != null ? String(base.importe) : "",
    referencia: "",
    cuentas: [],
    cargandoCuentas: false,
  };
}

/**
 * V-16 · Cobro total de una venta mayorista despachada. Cada medio se imputa a
 * una cuenta de tesorería compatible y la suma tiene que ser igual al total.
 *
 * @param {{
 *   venta: { id_comprobante: string, nombre_cliente: string, nombre_tipo_comprobante: string, numero_formateado: string, importe_total: number },
 *   medios: Array<{ id_medio_pago: string, nombre_medio_pago: string, tipo: string, requiere_referencia: boolean }>,
 * }} props
 */
export function CobroForm({ venta, medios }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const total = redondear(venta.importe_total);
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [observaciones, setObservaciones] = useState("");
  const [lineas, setLineas] = useState(() => [nuevaLineaMedio({ importe: total })]);
  const [errores, setErrores] = useState({});
  const [errorServer, setErrorServer] = useState(null);

  function limpiarErrores() {
    setErrores({});
    setErrorServer(null);
  }

  function medioDe(idMedio) {
    return medios.find((m) => m.id_medio_pago === idMedio) ?? null;
  }

  function setLinea(idx, cambios) {
    setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...cambios } : l)));
    limpiarErrores();
  }

  function elegirMedio(idx, idMedio) {
    setLinea(idx, {
      id_medio_pago: idMedio,
      id_cuenta_tesoreria: "",
      cuentas: [],
      cargandoCuentas: Boolean(idMedio),
    });
    if (!idMedio) return;
    startTransition(async () => {
      const res = await listarCuentasCompatibles(idMedio);
      const cuentas = res.data ?? [];
      setLineas((prev) =>
        prev.map((l, i) =>
          i === idx
            ? {
                ...l,
                cuentas,
                cargandoCuentas: false,
                id_cuenta_tesoreria: cuentas.length === 1 ? cuentas[0].id_cuenta : "",
              }
            : l
        )
      );
    });
  }

  const totalMedios = redondear(lineas.reduce((acc, l) => acc + (Number(l.importe) || 0), 0));
  const diferencia = redondear(totalMedios - total);

  function agregarLinea() {
    const restante = redondear(total - totalMedios);
    setLineas((prev) => [...prev, nuevaLineaMedio({ importe: restante > 0 ? restante : "" })]);
  }

  function quitarLinea(idx) {
    setLineas((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));
    limpiarErrores();
  }

  function validar() {
    const next = {};
    if (fecha && fecha > new Date().toISOString().slice(0, 10))
      next.fecha = "La fecha del cobro no puede ser futura.";

    for (const l of lineas) {
      if (!l.id_medio_pago || !l.id_cuenta_tesoreria || !(Number(l.importe) > 0)) {
        next.medios = "Cada línea necesita medio, cuenta e importe mayor a cero.";
        break;
      }
      const m = medioDe(l.id_medio_pago);
      if (m?.requiere_referencia && !l.referencia.trim()) {
        next.medios = `El medio "${m.nombre_medio_pago}" requiere una referencia.`;
        break;
      }
    }
    if (!next.medios && diferencia !== 0)
      next.medios = `La suma de los medios (${monedaFmt.format(totalMedios)}) tiene que ser igual al total de la venta (${monedaFmt.format(total)}).`;

    setErrores(next);
    return Object.keys(next).length === 0;
  }

  function enviar() {
    setErrorServer(null);
    if (!validar()) return;

    startTransition(async () => {
      const result = await registrarCobro({
        id_comprobante: venta.id_comprobante,
        fecha_cobro: fecha || null,
        observaciones,
        medios: lineas.map((l) => ({
          id_medio_pago: l.id_medio_pago,
          id_cuenta_tesoreria: l.id_cuenta_tesoreria,
          importe: Number(l.importe),
          referencia: l.referencia || null,
        })),
      });

      if (!result.ok) {
        const ui = mapErrorCobro(result);
        if (ui.field) setErrores((prev) => ({ ...prev, [ui.field]: ui.message }));
        else setErrorServer(ui.message);
        if (ui.reload) router.refresh();
        return;
      }

      router.push(result.id ? `/tesoreria/cobranzas/${result.id}` : "/tesoreria/cobranzas");
      router.refresh();
    });
  }

  return (
    <>
      <div className="palacio-card p-5 md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-900">
            {venta.nombre_tipo_comprobante}{" "}
            <span className="font-mono text-xs text-zinc-700">{venta.numero_formateado}</span> ·{" "}
            {venta.nombre_cliente}
          </h2>
          <span className="text-sm font-semibold text-zinc-900">
            Total a cobrar: {monedaFmt.format(total)}
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-800">Fecha del cobro</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => {
                setFecha(e.target.value);
                limpiarErrores();
              }}
              className="palacio-input"
            />
            {errores.fecha ? <p className="text-xs text-red-700">{errores.fecha}</p> : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-800">Observaciones</label>
            <input
              type="text"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              maxLength={300}
              className="palacio-input"
            />
          </div>
        </div>
      </div>

      <div className="palacio-card mt-6 overflow-hidden">
        <div className="border-b border-palacio-border px-5 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">Medios de pago</h2>
        </div>

        <div className="space-y-3 p-4">
          {lineas.map((l, idx) => {
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
                    onChange={(e) => setLinea(idx, { id_cuenta_tesoreria: e.target.value })}
                    disabled={!l.id_medio_pago || l.cargandoCuentas}
                    className="palacio-input"
                  >
                    <option value="">{l.cargandoCuentas ? "Cargando cuentas…" : "Cuenta…"}</option>
                    {l.cuentas.map((c) => (
                      <option key={c.id_cuenta} value={c.id_cuenta}>
                        {c.nombre_cuenta} ({c.tipo})
                      </option>
                    ))}
                  </select>
                  {l.id_medio_pago && !l.cargandoCuentas && l.cuentas.length === 0 ? (
                    <p className="mt-1 text-xs text-amber-700">
                      Ese medio no tiene cuentas habilitadas. Configuralas en Medios de pago.
                    </p>
                  ) : null}
                </div>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={l.importe}
                  onChange={(e) => setLinea(idx, { importe: e.target.value })}
                  className="palacio-input text-right"
                  placeholder="Importe"
                />

                <input
                  type="text"
                  value={l.referencia}
                  onChange={(e) => setLinea(idx, { referencia: e.target.value })}
                  className="palacio-input"
                  maxLength={120}
                  placeholder={m?.requiere_referencia ? "Referencia (requerida)" : "Referencia"}
                />

                <button
                  type="button"
                  onClick={() => quitarLinea(idx)}
                  disabled={lineas.length === 1}
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
          <button type="button" onClick={agregarLinea} className="palacio-btn-secondary px-3 py-2 text-sm">
            Agregar medio
          </button>
          <div className="text-right text-sm">
            <p className="text-palacio-muted">
              Total medios:{" "}
              <span className="font-semibold text-zinc-900">{monedaFmt.format(totalMedios)}</span>
            </p>
            {diferencia !== 0 ? (
              <p className="text-amber-700">
                {diferencia < 0
                  ? `Faltan ${monedaFmt.format(-diferencia)}`
                  : `Sobran ${monedaFmt.format(diferencia)}`}
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
          onClick={enviar}
          disabled={pending || diferencia !== 0}
          className="palacio-btn-primary px-4 py-2.5 text-sm"
        >
          {pending ? "Registrando…" : "Confirmar cobro"}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/ventas/ordenes/${venta.id_comprobante}`)}
          disabled={pending}
          className="palacio-btn-secondary px-4 py-2.5 text-sm"
        >
          Volver a la venta
        </button>
      </div>
    </>
  );
}
