"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { abrirCaja } from "@/lib/cajas/actions";
import { mapErrorCaja } from "@/lib/cajas/errores";

/**
 * V-14 · Apertura de caja. Una sucursal puede tener varias abiertas a la vez;
 * cada una vende el stock del depósito elegido.
 *
 * @param {{ depositos: Array<{ id_deposito: string, nombre_deposito: string }> }} props
 */
export function AbrirCajaForm({ depositos }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [monto, setMonto] = useState("");
  const [idDeposito, setIdDeposito] = useState(depositos.length === 1 ? depositos[0].id_deposito : "");
  const [observaciones, setObservaciones] = useState("");
  const [errores, setErrores] = useState({});
  const [errorServer, setErrorServer] = useState(null);

  function enviar(e) {
    e.preventDefault();
    setErrorServer(null);
    const next = {};
    if (!idDeposito) next.deposito = "Elegí el depósito de la sucursal.";
    if (monto === "" || !(Number(monto) >= 0)) next.monto = "Ingresá el efectivo inicial (puede ser cero).";
    setErrores(next);
    if (Object.keys(next).length > 0) return;

    startTransition(async () => {
      const result = await abrirCaja({ monto_inicial: monto, id_deposito: idDeposito, observaciones });
      if (!result.ok) {
        const ui = mapErrorCaja(result);
        if (ui.field === "monto" || ui.field === "deposito") setErrores({ [ui.field]: ui.message });
        else setErrorServer(ui.message);
        if (ui.reload) router.refresh();
        return;
      }
      router.push(result.id ? `/ventas/cajas/${result.id}` : "/ventas/cajas");
      router.refresh();
    });
  }

  return (
    <form onSubmit={enviar} className="palacio-card max-w-xl p-5 md:p-6">
      <h2 className="text-base font-semibold text-zinc-900">Abrir una caja</h2>
      <p className="mt-1 text-sm text-palacio-muted">
        Elegí el depósito de la sucursal. Esa caja solo puede vender el stock de ahí, y la sucursal puede tener varias
        cajas abiertas al mismo tiempo.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label htmlFor="deposito-caja" className="text-sm font-medium text-zinc-800">
            Depósito / sucursal
          </label>
          <select
            id="deposito-caja"
            value={idDeposito}
            onChange={(e) => {
              setIdDeposito(e.target.value);
              setErrores({});
            }}
            className="palacio-input"
          >
            <option value="">Elegí un depósito…</option>
            {depositos.map((d) => (
              <option key={d.id_deposito} value={d.id_deposito}>
                {d.nombre_deposito}
              </option>
            ))}
          </select>
          {errores.deposito ? <p className="text-xs text-red-700">{errores.deposito}</p> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="monto-inicial" className="text-sm font-medium text-zinc-800">
            Monto inicial en efectivo
          </label>
          <input
            id="monto-inicial"
            type="number"
            min="0"
            step="0.01"
            value={monto}
            onChange={(e) => {
              setMonto(e.target.value);
              setErrores({});
            }}
            className="palacio-input text-right"
            placeholder="0,00"
          />
          {errores.monto ? <p className="text-xs text-red-700">{errores.monto}</p> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="obs-apertura" className="text-sm font-medium text-zinc-800">
            Observaciones
          </label>
          <input
            id="obs-apertura"
            type="text"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            maxLength={300}
            className="palacio-input"
          />
        </div>
      </div>

      {errorServer ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorServer}</p>
      ) : null}

      <button type="submit" disabled={pending} className="palacio-btn-primary mt-5 px-4 py-2.5 text-sm">
        {pending ? "Abriendo…" : "Abrir caja"}
      </button>
    </form>
  );
}
