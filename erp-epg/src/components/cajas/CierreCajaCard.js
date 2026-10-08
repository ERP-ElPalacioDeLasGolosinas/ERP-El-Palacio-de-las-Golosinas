"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cerrarCaja } from "@/lib/cajas/actions";
import { mapErrorCaja } from "@/lib/cajas/errores";
import { moneda } from "@/components/cajas/formato";

/**
 * V-18 · Cierre de caja. Se habilita con un arqueo posterior al último
 * movimiento y muestra el resumen con el que va a quedar cerrada.
 *
 * @param {{ idCaja: string, resumen: Record<string, any> }} props
 */
export function CierreCajaCard({ idCaja, resumen }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState(null);

  const arqueo = resumen?.ultimo_arqueo ?? null;
  const habilitado = Boolean(resumen?.arqueo_al_dia && arqueo);

  function cerrar() {
    setError(null);
    startTransition(async () => {
      const result = await cerrarCaja({ id_caja: idCaja, observaciones });
      if (!result.ok) {
        const ui = mapErrorCaja(result);
        setError(ui.message);
        setConfirmando(false);
        router.refresh();
        return;
      }
      router.push(result.id ? `/ventas/cajas/${result.id}` : "/ventas/cajas/historial");
      router.refresh();
    });
  }

  return (
    <div className="palacio-card p-5">
      <h2 className="text-sm font-semibold text-zinc-900">Cierre de caja</h2>

      {!habilitado ? (
        <p className="mt-2 text-sm text-palacio-muted">
          Para cerrar la caja realizá un arqueo. Si registrás movimientos después del arqueo, hay que repetirlo.
        </p>
      ) : (
        <>
          <dl className="mt-3 space-y-1.5 text-sm">
            <Fila label="Ingresos (todos los medios)" valor={moneda(resumen.total_ingresos)} />
            <Fila label="Egresos (todos los medios)" valor={moneda(resumen.total_egresos)} />
            <Fila label="Efectivo teórico" valor={moneda(arqueo.saldo_teorico)} />
            <Fila label="Efectivo contado" valor={moneda(arqueo.saldo_fisico)} />
            <Fila
              label="Diferencia"
              valor={moneda(arqueo.diferencia)}
              className={Number(arqueo.diferencia) === 0 ? "text-zinc-900" : "text-amber-700"}
            />
          </dl>

          {confirmando ? (
            <div className="mt-4 space-y-3">
              <input
                type="text"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                maxLength={300}
                className="palacio-input"
                placeholder="Observaciones del cierre (opcional)"
              />
              <p className="text-sm text-zinc-800">
                Una vez cerrada, la caja no admite más movimientos. ¿Confirmás el cierre?
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={cerrar} disabled={pending} className="palacio-btn-primary px-4 py-2 text-sm">
                  {pending ? "Cerrando…" : "Confirmar cierre"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmando(false)}
                  disabled={pending}
                  className="palacio-btn-secondary px-4 py-2 text-sm"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              className="palacio-btn-primary mt-4 px-4 py-2 text-sm"
            >
              Cerrar caja
            </button>
          )}
        </>
      )}

      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
    </div>
  );
}

function Fila({ label, valor, className = "text-zinc-900" }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-palacio-muted">{label}</dt>
      <dd className={`font-medium ${className}`}>{valor}</dd>
    </div>
  );
}
