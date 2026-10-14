"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { solicitarCierreCaja } from "@/lib/cajas/v2-actions";
import { mapErrorCaja } from "@/lib/cajas/errores";
import { fechaHora } from "@/components/cajas/formato";

/**
 * El empleado pide el cierre después de un arqueo al día. Con el cierre pedido
 * la caja no admite movimientos hasta que el gerente cierra o rechaza.
 *
 * @param {{ sesion: Record<string, any>, resumen: Record<string, any> }} props
 */
export function SolicitarCierreCard({ sesion, resumen }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState(null);
  const pedido = sesion.estado === "Cierre solicitado";
  const habilitado = Boolean(resumen?.arqueo_al_dia && resumen?.ultimo_arqueo);

  // Con el cierre pedido, espera la decisión del gerente.
  useEffect(() => {
    if (!pedido) return undefined;
    const id = setInterval(() => router.refresh(), 10000);
    return () => clearInterval(id);
  }, [pedido, router]);

  function pedir() {
    setError(null);
    startTransition(async () => {
      const result = await solicitarCierreCaja({ id_sesion: sesion.id_sesion, id_caja: sesion.id_caja, observaciones });
      if (!result.ok) {
        setError(mapErrorCaja(result).message);
        router.refresh();
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="palacio-card p-5">
      <h2 className="text-sm font-semibold text-zinc-900">Cierre de caja</h2>

      {pedido ? (
        <p className="mt-2 text-sm text-palacio-muted">
          Pediste el cierre el {fechaHora(sesion.fecha_solicitud_cierre)}. Esperá a que el gerente lo confirme.
        </p>
      ) : (
        <>
          {sesion.motivo_rechazo ? (
            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              El gerente rechazó el cierre: {sesion.motivo_rechazo}
            </p>
          ) : null}
          {!habilitado ? (
            <p className="mt-2 text-sm text-palacio-muted">
              Para pedir el cierre realizá un arqueo. Si registrás movimientos después del arqueo, hay que repetirlo.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              <input
                type="text"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                maxLength={300}
                className="palacio-input"
                placeholder="Observaciones (opcional)"
              />
              <button type="button" onClick={pedir} disabled={pending} className="palacio-btn-primary px-4 py-2 text-sm">
                {pending ? "Enviando…" : "Pedir cierre"}
              </button>
            </div>
          )}
        </>
      )}

      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
    </div>
  );
}
