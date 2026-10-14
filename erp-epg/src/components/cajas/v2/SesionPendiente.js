"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { fechaHora, moneda } from "@/components/cajas/formato";
import { nombreCaja } from "@/lib/cajas/v2-estado";

/**
 * Espera de la aprobación del gerente. Refresca sola cada 10 segundos: cuando
 * la sesión se aprueba, la página redirige al POS.
 *
 * @param {{ sesion: Record<string, any> }} props
 */
export function SesionPendiente({ sesion }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 10000);
    return () => clearInterval(id);
  }, [router]);

  return (
    <div className="palacio-card mx-auto max-w-xl px-6 py-10 text-center">
      <span className="palacio-badge-lleno">Pendiente de apertura</span>
      <h2 className="mt-4 text-lg font-semibold text-zinc-900">
        {nombreCaja({ numero: sesion.numero, nombre: sesion.nombre_caja })}
      </h2>
      <p className="mt-2 text-sm text-palacio-muted">
        Pediste abrir la caja con {moneda(sesion.monto_inicial)} el {fechaHora(sesion.fecha_solicitud)}. Esperá a que el
        gerente apruebe la apertura.
      </p>
      <button type="button" onClick={() => router.refresh()} className="palacio-btn-secondary mt-5 px-4 py-2 text-sm">
        Actualizar
      </button>
    </div>
  );
}
