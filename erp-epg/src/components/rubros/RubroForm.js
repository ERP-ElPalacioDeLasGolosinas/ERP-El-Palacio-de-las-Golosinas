"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { actualizarRubro, crearRubro } from "@/lib/rubros/actions";

const initialState = { ok: false, error: null };

/**
 * @param {{ rubro?: { id_rubro: string, nombre_rubro: string, activo: boolean } | null }} props
 */
export function RubroForm({ rubro = null }) {
  const router = useRouter();
  const isEdit = Boolean(rubro?.id_rubro);

  async function submitAction(_prev, formData) {
    if (isEdit) {
      return actualizarRubro(rubro.id_rubro, formData);
    }
    return crearRubro(formData);
  }

  const [state, formAction, pending] = useActionState(
    submitAction,
    initialState
  );

  useEffect(() => {
    if (state?.ok) {
      router.push("/rubros");
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction} className="palacio-card max-w-xl p-5 md:p-6">
      <h2 className="mb-5 text-sm font-semibold text-zinc-900">
        {isEdit ? "Datos del rubro" : "Alta de rubro"}
      </h2>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="nombre_rubro"
            className="text-sm font-medium text-zinc-800"
          >
            Nombre <span className="text-palacio-red">*</span>
          </label>
          <input
            id="nombre_rubro"
            name="nombre_rubro"
            type="text"
            required
            defaultValue={rubro?.nombre_rubro ?? ""}
            className="palacio-input"
            placeholder="Ej. Golosinas"
          />
          <p className="text-xs text-palacio-muted">
            Primer nivel de clasificación (Golosinas, Snacks, Bebidas, …).
          </p>
        </div>

        <label className="flex items-center gap-2.5 text-sm text-zinc-800">
          <input
            type="checkbox"
            name="activo"
            value="true"
            defaultChecked={rubro?.activo ?? true}
            className="size-4 rounded border-zinc-300 accent-palacio-red"
          />
          Rubro activo
        </label>

        {state?.error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t border-palacio-border pt-4">
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
            onClick={() => router.push("/rubros")}
            className="palacio-btn-secondary px-4 py-2.5 text-sm"
          >
            Cancelar
          </button>
        </div>
      </div>
    </form>
  );
}
