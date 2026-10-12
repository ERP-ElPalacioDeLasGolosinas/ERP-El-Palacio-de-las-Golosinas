"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { realizarArqueo } from "@/lib/cajas/actions";
import { mapErrorCaja } from "@/lib/cajas/errores";
import { UMBRAL_DIFERENCIA_ARQUEO } from "@/lib/cajas/constantes";
import { hora, moneda, redondear } from "@/components/cajas/formato";

const BILLETES = [20000, 10000, 2000, 1000, 500, 200, 100, 50, 20, 10];

function conteoVacio() {
  return Object.fromEntries(BILLETES.map((d) => [String(d), ""]));
}

/**
 * V-17 · Arqueo por denominación. El empleado carga cuántos billetes hay
 * de cada valor y el total se calcula acá, contra el saldo teórico.
 *
 * @param {{ idCaja: string, resumen: Record<string, any> }} props
 */
export function ArqueoCajaForm({ idCaja, resumen }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [cantidades, setCantidades] = useState(conteoVacio);
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState(null);

  const teorico = Number(resumen?.efectivo?.saldo_teorico) || 0;
  const detalle = BILLETES.map((denominacion) => {
    const cantidad = Number(cantidades[String(denominacion)]) || 0;
    return { denominacion, cantidad, importe: denominacion * cantidad };
  });
  const contado = redondear(detalle.reduce((a, b) => a + b.importe, 0));
  const diferencia = redondear(contado - teorico);
  const supera = Math.abs(diferencia) >= UMBRAL_DIFERENCIA_ARQUEO;
  const ultimo = resumen?.ultimo_arqueo ?? null;

  function setCantidad(denominacion, valor) {
    if (valor !== "" && !/^\d+$/.test(valor)) return;
    setCantidades((prev) => ({ ...prev, [String(denominacion)]: valor }));
    setError(null);
  }

  function enviar(e) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await realizarArqueo({
        id_caja: idCaja,
        saldo_fisico: contado,
        observaciones,
        detalle_billetes: detalle
          .filter((b) => b.cantidad > 0)
          .map(({ denominacion, cantidad }) => ({ denominacion, cantidad })),
      });
      if (!result.ok) {
        const ui = mapErrorCaja(result);
        setError(ui.message);
        if (ui.reload) router.refresh();
        return;
      }
      setCantidades(conteoVacio());
      setObservaciones("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={enviar} className="palacio-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-900">Arqueo de efectivo</h2>
        {resumen?.arqueo_al_dia ? (
          <span className="palacio-badge-activo">Al día</span>
        ) : (
          <span className="palacio-badge-inactivo">Pendiente</span>
        )}
      </div>

      {ultimo ? (
        <p className="mt-2 text-xs text-palacio-muted">
          Último arqueo {hora(ultimo.creado)}: contado {moneda(ultimo.saldo_fisico)}, diferencia{" "}
          <span className={Number(ultimo.diferencia) === 0 ? "" : "font-semibold text-amber-700"}>
            {moneda(ultimo.diferencia)}
          </span>
          {resumen?.arqueo_al_dia ? "" : " (hubo movimientos después)"}
        </p>
      ) : null}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs font-medium text-palacio-muted">Saldo teórico</span>
          <span className="palacio-input bg-zinc-50 text-right font-medium">{moneda(teorico)}</span>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-palacio-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-palacio-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Billete</th>
              <th className="px-3 py-2 text-right font-medium">Cantidad</th>
              <th className="px-3 py-2 text-right font-medium">Importe</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-palacio-border">
            {detalle.map((b) => (
              <tr key={b.denominacion}>
                <td className="px-3 py-2 font-medium text-zinc-900">{moneda(b.denominacion)}</td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={cantidades[String(b.denominacion)]}
                    onChange={(e) => setCantidad(b.denominacion, e.target.value)}
                    className="palacio-input ml-auto w-24 text-right"
                    placeholder="0"
                    aria-label={`Cantidad de billetes de ${b.denominacion}`}
                  />
                </td>
                <td className="px-3 py-2 text-right text-zinc-700">{moneda(b.importe)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-palacio-border bg-zinc-50">
              <td className="px-3 py-2 font-semibold text-zinc-900" colSpan={2}>
                Total contado
              </td>
              <td className="px-3 py-2 text-right font-semibold text-zinc-900">{moneda(contado)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-3 flex flex-col gap-1">
        <label className="text-xs font-medium text-palacio-muted">Observaciones</label>
        <input
          type="text"
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          maxLength={300}
          className="palacio-input"
        />
      </div>

      <p
        className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
          supera
            ? "border-amber-300 bg-amber-50 text-amber-900"
            : diferencia === 0
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-palacio-border bg-zinc-50 text-zinc-800"
        }`}
      >
        {diferencia === 0
          ? "Sin diferencia."
          : `${diferencia > 0 ? "Sobrante" : "Faltante"} de ${moneda(Math.abs(diferencia))}.`}
        {supera ? ` Supera el umbral de ${moneda(UMBRAL_DIFERENCIA_ARQUEO)}: revisá el conteo antes de confirmar.` : ""}
      </p>

      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <button type="submit" disabled={pending} className="palacio-btn-primary mt-4 px-4 py-2 text-sm">
        {pending ? "Registrando…" : "Registrar arqueo"}
      </button>
    </form>
  );
}
