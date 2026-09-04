"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  actualizarMedioPago,
  crearMedioPago,
} from "@/lib/medios-pago/actions";
import { mapErrorMedioPago } from "@/lib/medios-pago/errores";

/**
 * Modal de alta / edición de medio de pago.
 *
 * @param {{
 *   onClose: () => void,
 *   medioPago?: {
 *     id_medio_pago: string,
 *     nombre_medio_pago: string,
 *     requiere_referencia: boolean,
 *   } | null,
 * }} props
 */
export function MedioPagoFormModal({ onClose, medioPago = null }) {
  const router = useRouter();
  const isEdit = Boolean(medioPago?.id_medio_pago);
  const [pending, startTransition] = useTransition();
  const [nombre, setNombre] = useState(
    () => medioPago?.nombre_medio_pago ?? ""
  );
  const [requiereReferencia, setRequiereReferencia] = useState(
    () => medioPago?.requiere_referencia ?? false
  );
  const [errorNombre, setErrorNombre] = useState(null);
  const [errorServer, setErrorServer] = useState(null);
  const nombreRef = useRef(null);

  useEffect(() => {
    nombreRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function validar() {
    if (nombre.trim().length === 0) {
      setErrorNombre("El nombre es obligatorio.");
      return false;
    }
    setErrorNombre(null);
    return true;
  }

  function onSubmit(e) {
    e.preventDefault();
    setErrorServer(null);
    if (!validar()) return;

    const formData = new FormData();
    formData.set("nombre_medio_pago", nombre.trim());
    if (requiereReferencia) {
      formData.set("requiere_referencia", "on");
    }

    startTransition(async () => {
      const result = isEdit
        ? await actualizarMedioPago(medioPago.id_medio_pago, formData)
        : await crearMedioPago(formData);

      if (!result.ok) {
        const ui = mapErrorMedioPago(result);
        if (ui.field === "nombre") {
          setErrorNombre(ui.message);
        } else {
          setErrorServer(ui.message);
        }
        if (ui.reload) router.refresh();
        return;
      }

      onClose();
      router.refresh();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="medio-pago-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="palacio-card w-full max-w-md p-5 md:p-6">
        <h2
          id="medio-pago-modal-title"
          className="mb-5 text-sm font-semibold text-zinc-900"
        >
          {isEdit ? "Editar medio de pago" : "Nuevo medio de pago"}
        </h2>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="medio-pago-nombre"
              className="text-sm font-medium text-zinc-800"
            >
              Nombre <span className="text-palacio-red">*</span>
            </label>
            <input
              id="medio-pago-nombre"
              ref={nombreRef}
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="palacio-input"
              placeholder="Ej. Efectivo, Transferencia, Cheque"
              maxLength={80}
            />
            {errorNombre ? (
              <p className="text-xs text-red-600">{errorNombre}</p>
            ) : null}
          </div>

          <label className="flex items-start gap-2.5 rounded-lg border border-palacio-border bg-zinc-50 px-4 py-3 text-sm text-zinc-800">
            <input
              type="checkbox"
              checked={requiereReferencia}
              onChange={(e) => setRequiereReferencia(e.target.checked)}
              className="mt-0.5 size-4 rounded border-zinc-300 accent-palacio-red"
            />
            <span>
              <span className="font-medium">Requiere referencia</span>
              <span className="mt-0.5 block text-xs text-palacio-muted">
                Si está marcado, al usar este medio se pedirá un número de
                referencia (ej. transferencia o cheque).
              </span>
            </span>
          </label>

          {errorServer ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorServer}
            </p>
          ) : null}

          <div className="mt-1 flex flex-wrap gap-2 border-t border-palacio-border pt-4">
            <button
              type="submit"
              disabled={pending}
              className="palacio-btn-primary px-4 py-2.5 text-sm"
            >
              {pending
                ? "Guardando…"
                : isEdit
                  ? "Guardar cambios"
                  : "Crear medio de pago"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="palacio-btn-secondary px-4 py-2.5 text-sm"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
