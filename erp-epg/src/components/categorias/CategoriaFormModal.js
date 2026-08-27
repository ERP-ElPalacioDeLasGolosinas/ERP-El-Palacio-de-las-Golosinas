"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  actualizarCategoria,
  crearCategoria,
} from "@/lib/categorias/actions";

/**
 * Modal reutilizable para alta y edición de categorías. Se monta sólo cuando
 * está abierto; el padre le pasa `key` para arrancar con estado fresco.
 *
 * @param {{
 *   onClose: () => void,
 *   categoria?: {
 *     id_categoria: string,
 *     nombre_categoria: string,
 *     id_rubro: string,
 *   } | null,
 *   rubros: Array<{ id_rubro: string, nombre_rubro: string }>,
 * }} props
 */
export function CategoriaFormModal({ onClose, categoria = null, rubros }) {
  const router = useRouter();
  const isEdit = Boolean(categoria?.id_categoria);
  const [pending, startTransition] = useTransition();
  const [nombre, setNombre] = useState(() => categoria?.nombre_categoria ?? "");
  const [idRubro, setIdRubro] = useState(() => categoria?.id_rubro ?? "");
  const [errorNombre, setErrorNombre] = useState(null);
  const [errorRubro, setErrorRubro] = useState(null);
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

    let invalido = false;
    if (nombre.trim().length === 0) {
      setErrorNombre("El nombre es obligatorio.");
      invalido = true;
    } else {
      setErrorNombre(null);
    }
    if (!idRubro) {
      setErrorRubro("Elegí un rubro.");
      invalido = true;
    } else {
      setErrorRubro(null);
    }
    if (invalido) return;

    const formData = new FormData();
    formData.set("nombre_categoria", nombre.trim());
    formData.set("id_rubro", idRubro);

    startTransition(async () => {
      const result = isEdit
        ? await actualizarCategoria(categoria.id_categoria, formData)
        : await crearCategoria(formData);

      if (!result.ok) {
        if (result.code === "CAT06") {
          setErrorRubro(result.error);
        } else if (result.code === "CAT01" || result.code === "CAT02") {
          setErrorNombre(result.error);
        } else {
          setErrorServer(result.error);
        }
        if (result.code === "CAT03") router.refresh();
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
      aria-labelledby="categoria-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="palacio-card w-full max-w-md p-5 md:p-6">
        <h2
          id="categoria-modal-title"
          className="mb-5 text-sm font-semibold text-zinc-900"
        >
          {isEdit ? "Editar categoría" : "Nueva categoría"}
        </h2>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="categoria-nombre"
              className="text-sm font-medium text-zinc-800"
            >
              Nombre <span className="text-palacio-red">*</span>
            </label>
            <input
              id="categoria-nombre"
              ref={nombreRef}
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="palacio-input"
              placeholder="Ej. Chocolates"
              maxLength={80}
            />
            {errorNombre ? (
              <p className="text-xs text-red-600">{errorNombre}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="categoria-rubro"
              className="text-sm font-medium text-zinc-800"
            >
              Rubro <span className="text-palacio-red">*</span>
            </label>
            <select
              id="categoria-rubro"
              value={idRubro}
              onChange={(e) => setIdRubro(e.target.value)}
              className="palacio-input"
            >
              <option value="">Seleccioná un rubro…</option>
              {rubros.map((r) => (
                <option key={r.id_rubro} value={r.id_rubro}>
                  {r.nombre_rubro}
                </option>
              ))}
            </select>
            {errorRubro ? (
              <p className="text-xs text-red-600">{errorRubro}</p>
            ) : null}
            {isEdit ? (
              <p className="text-xs text-palacio-muted">
                Cambiar el rubro reasocia la categoría y actualiza los productos
                asociados automáticamente.
              </p>
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
                  : "Crear categoría"}
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
