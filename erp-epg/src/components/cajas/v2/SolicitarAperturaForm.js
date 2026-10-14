"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { solicitarAperturaCaja } from "@/lib/cajas/v2-actions";
import { mapErrorCaja } from "@/lib/cajas/errores";
import { TarjetaCaja } from "@/components/cajas/v2/TarjetaCaja";

/**
 * El empleado elige una caja libre y carga el efectivo con el que arranca.
 * La sesión queda pendiente hasta que el gerente la aprueba.
 *
 * @param {{ cajas: Array<{ id_registradora: string, numero: number, nombre: string | null, nombre_deposito: string, sesion: Record<string, any> | null }> }} props
 */
export function SolicitarAperturaForm({ cajas }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const libres = cajas.filter((c) => !c.sesion);
  const [idCaja, setIdCaja] = useState(libres.length === 1 ? libres[0].id_registradora : "");
  const [monto, setMonto] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [errores, setErrores] = useState({});
  const [errorServer, setErrorServer] = useState(null);

  function enviar(e) {
    e.preventDefault();
    setErrorServer(null);
    const next = {};
    if (!idCaja) next.caja = "Elegí la caja en la que vas a trabajar.";
    if (monto === "" || !(Number(monto) >= 0)) next.monto = "Ingresá el efectivo inicial (puede ser cero).";
    setErrores(next);
    if (Object.keys(next).length > 0) return;

    startTransition(async () => {
      const result = await solicitarAperturaCaja({ id_registradora: idCaja, monto_inicial: monto, observaciones });
      if (!result.ok) {
        const ui = mapErrorCaja(result);
        setErrorServer(ui.message);
        if (ui.reload) router.refresh();
        return;
      }
      router.refresh();
    });
  }

  if (cajas.length === 0) {
    return (
      <div className="palacio-card px-6 py-12 text-center text-sm text-palacio-muted">
        Todavía no hay cajas en el local. Pedile al gerente que las cree.
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="palacio-card p-5 md:p-6">
      <h2 className="text-base font-semibold text-zinc-900">Elegí tu caja</h2>
      <p className="mt-1 text-sm text-palacio-muted">
        Cargá el efectivo con el que arranca la caja. El gerente tiene que aprobar la apertura antes de que puedas vender.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cajas.map((c) => {
          const libre = !c.sesion;
          return (
            <TarjetaCaja
              key={c.id_registradora}
              as="button"
              caja={c}
              seleccionada={idCaja === c.id_registradora}
              mostrarDeposito={false}
              disabled={!libre}
              onClick={() => {
                setIdCaja(c.id_registradora);
                setErrores({});
              }}
              className={libre ? "transition hover:border-zinc-400" : "cursor-not-allowed opacity-60"}
            >
              <p className="text-xs text-palacio-muted">
                {libre ? "Libre para trabajar" : `Ocupada por ${c.sesion.empleado_nombre}`}
              </p>
            </TarjetaCaja>
          );
        })}
      </div>
      {errores.caja ? <p className="mt-2 text-xs text-red-700">{errores.caja}</p> : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="monto-inicial" className="text-sm font-medium text-zinc-800">
            Monto inicial en efectivo <span className="text-palacio-red">*</span>
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

      <button type="submit" disabled={pending || libres.length === 0} className="palacio-btn-primary mt-5 px-4 py-2.5 text-sm">
        {pending ? "Enviando…" : "Pedir apertura"}
      </button>
    </form>
  );
}
