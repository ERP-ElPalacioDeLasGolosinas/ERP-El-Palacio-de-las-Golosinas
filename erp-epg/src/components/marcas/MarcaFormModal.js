"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actualizarMarca, crearMarca } from "@/lib/marcas/actions";
import { mapErrorMarca } from "@/lib/marcas/errores";

/**
 * Modal de alta / edición de marca. Se monta sólo cuando está abierto; el padre
 * le pasa `key` para arrancar con estado fresco.
 *
 * @param {{
 *   onClose: () => void,
 *   marca?: { id_marca: string, nombre_marca: string } | null,
 * }} props
 */
export function MarcaFormModal({ onClose, marca = null }) {
  const router = useRouter();
  const isEdit = Boolean(marca?.id_marca);
  const [pending, startTransition] = useTransition();
  const [nombre, setNombre] = useState(() => marca?.nombre_marca ?? "");
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
    formData.set("nombre_marca", nombre.trim());

    startTransition(async () => {
      const result = isEdit
        ? await actualizarMarca(marca.id_marca, formData)
        : await crearMarca(formData);

      if (!result.ok) {
        const ui = mapErrorMarca(result);
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
      aria-labelledby="marca-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="palacio-card w-full max-w-md p-5 md:p-6">
        <h2
          id="marca-modal-title"
          className="mb-5 text-sm font-semibold text-zinc-900"
        >
          {isEdit ? "Editar marca" : "Nueva marca"}
        </h2>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="marca-nombre"
              className="text-sm font-medium text-zinc-800"
            >
              Nombre <span className="text-palacio-red">*</span>
            </label>
            <input
              id="marca-nombre"
              ref={nombreRef}
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="palacio-input"
              placeholder="Ej. Arcor"
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
                  : "Crear marca"}
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
