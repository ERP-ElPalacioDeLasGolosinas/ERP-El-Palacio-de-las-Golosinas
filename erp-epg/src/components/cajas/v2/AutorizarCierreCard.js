"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cerrarSesionCaja, rechazarCierreCaja } from "@/lib/cajas/v2-actions";
import { mapErrorCaja } from "@/lib/cajas/errores";
import { fechaHora, moneda } from "@/components/cajas/formato";

/**
 * Gerente: revisa el arqueo y cierra la caja, o rechaza el cierre pedido y la
 * devuelve al empleado. También puede cerrar sin pedido previo.
 *
 * @param {{ sesion: Record<string, any>, resumen: Record<string, any> }} props
 */
export function AutorizarCierreCard({ sesion, resumen }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [modo, setModo] = useState(/** @type {null | "cerrar" | "rechazar"} */ (null));
  const [texto, setTexto] = useState("");
  const [error, setError] = useState(null);

  const pedido = sesion.estado === "Cierre solicitado";
  const arqueo = resumen?.ultimo_arqueo ?? null;
  const habilitado = Boolean(resumen?.arqueo_al_dia && arqueo);

  function ejecutar() {
    setError(null);
    startTransition(async () => {
      const result =
        modo === "cerrar"
          ? await cerrarSesionCaja({ id_sesion: sesion.id_sesion, id_caja: sesion.id_caja, observaciones: texto })
          : await rechazarCierreCaja({ id_sesion: sesion.id_sesion, id_caja: sesion.id_caja, motivo: texto });
      if (!result.ok) {
        setError(mapErrorCaja(result).message);
        setModo(null);
        router.refresh();
        return;
      }
      setModo(null);
      setTexto("");
      router.refresh();
    });
  }

  return (
    <div className={`palacio-card p-5 ${pedido ? "border-sky-300" : ""}`}>
      <h2 className="text-sm font-semibold text-zinc-900">Autorizar cierre</h2>
      {pedido ? (
        <p className="mt-1 text-sm text-zinc-800">
          {sesion.empleado_nombre} pidió el cierre el {fechaHora(sesion.fecha_solicitud_cierre)}
          {sesion.observaciones_cierre ? ` · ${sesion.observaciones_cierre}` : ""}.
        </p>
      ) : (
        <p className="mt-1 text-sm text-palacio-muted">El empleado todavía no pidió el cierre. Podés cerrar igual.</p>
      )}

      {!habilitado ? (
        <p className="mt-2 text-sm text-palacio-muted">
          Para cerrar hace falta un arqueo posterior al último movimiento.
        </p>
      ) : (
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
      )}

      {modo ? (
        <div className="mt-4 space-y-3">
          <input
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={300}
            className="palacio-input"
            placeholder={modo === "cerrar" ? "Observaciones del cierre (opcional)" : "Motivo del rechazo"}
          />
          <p className="text-sm text-zinc-800">
            {modo === "cerrar"
              ? "Una vez cerrada, la caja no admite más movimientos. ¿Confirmás el cierre?"
              : "La caja vuelve a quedar abierta para el empleado."}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={ejecutar} disabled={pending} className="palacio-btn-primary px-4 py-2 text-sm">
              {pending ? "Procesando…" : modo === "cerrar" ? "Confirmar cierre" : "Rechazar cierre"}
            </button>
            <button
              type="button"
              onClick={() => setModo(null)}
              disabled={pending}
              className="palacio-btn-secondary px-4 py-2 text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setModo("cerrar")}
            disabled={!habilitado}
            className="palacio-btn-primary px-4 py-2 text-sm"
          >
            Cerrar caja
          </button>
          {pedido ? (
            <button type="button" onClick={() => setModo("rechazar")} className="palacio-btn-secondary px-4 py-2 text-sm">
              Rechazar cierre
            </button>
          ) : null}
        </div>
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
