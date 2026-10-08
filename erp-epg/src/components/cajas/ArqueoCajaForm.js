"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { realizarArqueo } from "@/lib/cajas/actions";
import { mapErrorCaja } from "@/lib/cajas/errores";
import { UMBRAL_DIFERENCIA_ARQUEO } from "@/lib/cajas/constantes";
import { hora, moneda, redondear } from "@/components/cajas/formato";

/**
 * V-17 · Arqueo: se cuenta el efectivo y se compara contra el saldo teórico.
 * Se puede repetir; el cierre usa el último.
 *
 * @param {{ idCaja: string, resumen: Record<string, any> }} props
 */
export function ArqueoCajaForm({ idCaja, resumen }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [contado, setContado] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState(null);

  const teorico = Number(resumen?.efectivo?.saldo_teorico) || 0;
  const diferencia = contado === "" ? null : redondear(Number(contado) - teorico);
  const supera = diferencia != null && Math.abs(diferencia) >= UMBRAL_DIFERENCIA_ARQUEO;
  const ultimo = resumen?.ultimo_arqueo ?? null;

  function enviar(e) {
    e.preventDefault();
    if (contado === "" || !(Number(contado) >= 0)) {
      setError("Ingresá el efectivo contado (cero o más).");
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await realizarArqueo({ id_caja: idCaja, saldo_fisico: contado, observaciones });
      if (!result.ok) {
        const ui = mapErrorCaja(result);
        setError(ui.message);
        if (ui.reload) router.refresh();
        return;
      }
      setContado("");
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
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-palacio-muted">Saldo teórico</span>
          <span className="palacio-input bg-zinc-50 text-right font-medium">{moneda(teorico)}</span>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-palacio-muted">Efectivo contado</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={contado}
            onChange={(e) => {
              setContado(e.target.value);
              setError(null);
            }}
            className="palacio-input text-right"
          />
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="text-xs font-medium text-palacio-muted">Observaciones</label>
          <input
            type="text"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            maxLength={300}
            className="palacio-input"
          />
        </div>
      </div>

      {diferencia != null ? (
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
      ) : null}

      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <button type="submit" disabled={pending} className="palacio-btn-primary mt-4 px-4 py-2 text-sm">
        {pending ? "Registrando…" : "Registrar arqueo"}
      </button>
    </form>
  );
}
