"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actualizarRubro, crearRubro } from "@/lib/rubros/actions";

/**
 * Modal reutilizable para alta y edición de rubros. Se monta sólo cuando está
 * abierto; el padre le pasa `key` para que cada apertura arranque con estado
 * fresco.
 *
 * @param {{
 *   onClose: () => void,
 *   rubro?: { id_rubro: string, nombre_rubro: string } | null,
 * }} props
 */
export function RubroFormModal({ onClose, rubro = null }) {
  const router = useRouter();
  const isEdit = Boolean(rubro?.id_rubro);
  const [pending, startTransition] = useTransition();
  const [nombre, setNombre] = useState(() => rubro?.nombre_rubro ?? "");
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

  function onSubmit(e) {
    e.preventDefault();
    setErrorServer(null);

    if (nombre.trim().length === 0) {
      setErrorNombre("El nombre es obligatorio.");
      return;
    }
    setErrorNombre(null);

    const formData = new FormData();
    formData.set("nombre_rubro", nombre.trim());

    startTransition(async () => {
      const result = isEdit
        ? await actualizarRubro(rubro.id_rubro, formData)
        : await crearRubro(formData);

      if (!result.ok) {
        setErrorServer(result.error);
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
      aria-labelledby="rubro-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="palacio-card w-full max-w-md p-5 md:p-6">
        <h2
          id="rubro-modal-title"
          className="mb-5 text-sm font-semibold text-zinc-900"
        >
          {isEdit ? "Editar rubro" : "Nuevo rubro"}
        </h2>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="rubro-nombre"
              className="text-sm font-medium text-zinc-800"
            >
              Nombre <span className="text-palacio-red">*</span>
            </label>
            <input
              id="rubro-nombre"
              ref={nombreRef}
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="palacio-input"
              placeholder="Ej. Golosinas"
              maxLength={80}
            />
            {errorNombre ? (
              <p className="text-xs text-red-600">{errorNombre}</p>
            ) : null}
          </div>

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
                  : "Crear rubro"}
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
