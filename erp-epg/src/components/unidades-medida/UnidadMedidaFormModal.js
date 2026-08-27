"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  actualizarUnidadMedida,
  crearUnidadMedida,
} from "@/lib/unidades-medida/actions";

const ABREVIATURA_RE = /^[a-z]{3}$/;

/**
 * Modal reutilizable para alta y edición de unidades de medida.
 * Se monta sólo cuando está abierto; el padre le pasa `key` para que cada
 * apertura arranque con estado fresco (sin resetear vía efecto).
 *
 * @param {{
 *   onClose: () => void,
 *   unidad?: {
 *     id_unidad_medida: string,
 *     nombre: string,
 *     abreviatura: string,
 *   } | null,
 * }} props
 */
export function UnidadMedidaFormModal({ onClose, unidad = null }) {
  const router = useRouter();
  const isEdit = Boolean(unidad?.id_unidad_medida);
  const [pending, startTransition] = useTransition();
  const [nombre, setNombre] = useState(() => unidad?.nombre ?? "");
  const [abreviatura, setAbreviatura] = useState(
    () => unidad?.abreviatura ?? ""
  );
  const [errores, setErrores] = useState({ nombre: null, abreviatura: null });
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

  /** Validación cliente, espejo de los `check` de la tabla. */
  function validar() {
    const next = { nombre: null, abreviatura: null };
    if (nombre.trim().length === 0) {
      next.nombre = "El nombre es obligatorio.";
    }
    if (!ABREVIATURA_RE.test(abreviatura.trim())) {
      next.abreviatura =
        "La abreviatura debe tener exactamente 3 letras minúsculas.";
    }
    setErrores(next);
    return !next.nombre && !next.abreviatura;
  }

  function onSubmit(e) {
    e.preventDefault();
    setErrorServer(null);
    if (!validar()) return;

    const formData = new FormData();
    formData.set("nombre", nombre.trim());
    formData.set("abreviatura", abreviatura.trim().toLowerCase());

    startTransition(async () => {
      const result = isEdit
        ? await actualizarUnidadMedida(unidad.id_unidad_medida, formData)
        : await crearUnidadMedida(formData);

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
      aria-labelledby="um-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="palacio-card w-full max-w-md p-5 md:p-6">
        <h2
          id="um-modal-title"
          className="mb-5 text-sm font-semibold text-zinc-900"
        >
          {isEdit ? "Editar unidad de medida" : "Nueva unidad de medida"}
        </h2>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="um-nombre"
              className="text-sm font-medium text-zinc-800"
            >
              Nombre <span className="text-palacio-red">*</span>
            </label>
            <input
              id="um-nombre"
              ref={nombreRef}
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="palacio-input"
              placeholder="Ej. Kilogramos"
              maxLength={80}
            />
            {errores.nombre ? (
              <p className="text-xs text-red-600">{errores.nombre}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="um-abreviatura"
              className="text-sm font-medium text-zinc-800"
            >
              Abreviatura <span className="text-palacio-red">*</span>
            </label>
            <input
              id="um-abreviatura"
              type="text"
              value={abreviatura}
              onChange={(e) => setAbreviatura(e.target.value.toLowerCase())}
              className="palacio-input font-mono lowercase"
              placeholder="kgs"
              maxLength={3}
              autoComplete="off"
              spellCheck={false}
            />
            <p className="text-xs text-palacio-muted">
              Exactamente 3 letras minúsculas (ej. <code>kgs</code>,{" "}
              <code>uni</code>, <code>lts</code>).
            </p>
            {errores.abreviatura ? (
              <p className="text-xs text-red-600">{errores.abreviatura}</p>
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
                  : "Crear unidad"}
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
