"use client";

import { useActionState, useEffect, useRef } from "react";
import { crearUnidadMedida, actualizarUnidadMedida } from "./actions";

const initialState = { error: null, success: false };

export default function UnidadMedidaForm({ unidad, onClose }) {
  const dialogRef = useRef(null);
  const action = unidad ? actualizarUnidadMedida : crearUnidadMedida;
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="w-full max-w-sm rounded-lg border border-border bg-surface p-0 text-ink [color-scheme:light] backdrop:bg-black/40"
    >
      <form action={formAction} className="flex flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold text-ink">
          {unidad ? "Editar unidad de medida" : "Nueva unidad de medida"}
        </h2>

        {unidad && (
          <input type="hidden" name="id" value={unidad.id_unidad_medida} />
        )}

        <div className="flex flex-col gap-1">
          <label htmlFor="nombre" className="text-sm font-medium text-ink">
            Nombre
          </label>
          <input
            id="nombre"
            name="nombre"
            type="text"
            required
            defaultValue={unidad?.nombre_unidad_medida ?? ""}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="abreviatura" className="text-sm font-medium text-ink">
            Abreviatura
          </label>
          <input
            id="abreviatura"
            name="abreviatura"
            type="text"
            required
            defaultValue={unidad?.abreviatura_unidad_medida ?? ""}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft"
          />
        </div>

        {state.error && (
          <p role="alert" className="text-sm text-primary">
            {state.error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-2 text-sm font-medium text-ink-muted hover:text-ink"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-ink shadow-sm transition hover:bg-accent-strong disabled:opacity-60"
          >
            {pending ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
