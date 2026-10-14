"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { VentaForm } from "@/components/ventas/VentaForm";

/**
 * POS de la caja: el mismo `VentaForm`, fijo a esta caja. Después de cada venta
 * el formulario se limpia para la siguiente y se refresca el resumen de la caja.
 *
 * @param {Omit<Parameters<typeof VentaForm>[0], "cajaFija" | "onRegistrada">} props
 */
export function PosVenta(props) {
  const router = useRouter();
  const [vuelta, setVuelta] = useState(0);
  const [ultima, setUltima] = useState(/** @type {string | null} */ (null));

  function registrada(result) {
    setUltima(result?.id ?? null);
    setVuelta((v) => v + 1);
    router.refresh();
  }

  return (
    <div>
      {vuelta > 0 ? (
        <div className="palacio-card mb-4 flex flex-wrap items-center justify-between gap-3 border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-900">
          <span className="font-medium">Venta registrada y cobrada.</span>
          {ultima ? (
            <Link href={`/ventas/ordenes/${ultima}`} className="underline">
              Ver comprobante
            </Link>
          ) : null}
        </div>
      ) : null}
      <VentaForm key={vuelta} {...props} cajaFija onRegistrada={registrada} />
    </div>
  );
}
