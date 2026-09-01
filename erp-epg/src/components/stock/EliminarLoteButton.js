"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { eliminarLote, motivoBloqueoEliminarLote } from "@/lib/stock/actions";
import { mapErrorLote } from "@/lib/stock/errores";

/**
 * Botón "Eliminar" para un lote (`inventario`). Antes de confirmar, consulta
 * `fn_lote_motivo_bloqueo_delete` (p. ej. si el lote ya tiene stock consumido)
 * y, si está libre, pide confirmación explícita antes de invocar
 * `fn_lote_eliminar` (revierte el stock aportado, borra el lote y su compra
 * de soporte).
 *
 * @param {{ idLote: string, nombreCompleto: string, className?: string }} props
 */
export function EliminarLoteButton({ idLote, nombreCompleto, className }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function eliminar() {
    startTransition(async () => {
      const { motivo, error: errorMotivo } =
        await motivoBloqueoEliminarLote(idLote);
      if (errorMotivo) {
        window.alert(errorMotivo);
        return;
      }
      if (motivo) {
        window.alert(motivo);
        return;
      }

      const confirmado = window.confirm(
        `¿Eliminar el lote de "${nombreCompleto}"? Esto revertirá el stock que aportó este lote y no se puede deshacer.`
      );
      if (!confirmado) return;

      const result = await eliminarLote(idLote);
      if (!result.ok) {
        window.alert(mapErrorLote(result).message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={eliminar}
      className={className ?? "palacio-action-btn palacio-action-danger"}
    >
      Eliminar
    </button>
  );
}
