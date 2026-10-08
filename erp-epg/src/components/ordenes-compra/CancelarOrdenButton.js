"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelarOrden } from "@/lib/ordenes-compra/actions";
import { mapErrorOrden } from "@/lib/ordenes-compra/errores";

/** @param {{ id: string, numero: string }} props */
export function CancelarOrdenButton({ id, numero }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(null);

  function cancelar() {
    const ok = window.confirm(
      `¿Cancelar la orden ${numero}? No se van a poder recibir mercadería ni cargar facturas contra ella.`
    );
    if (!ok) return;

    startTransition(async () => {
      const result = await cancelarOrden(id);
      if (!result.ok) {
        setError(mapErrorOrden(result).message);
        return;
      }
      setError(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        className="palacio-btn-secondary"
        disabled={pending}
        onClick={cancelar}
      >
        {pending ? "Cancelando…" : "Cancelar orden"}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
