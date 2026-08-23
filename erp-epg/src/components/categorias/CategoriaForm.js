"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  actualizarCategoria,
  crearCategoria,
} from "@/lib/categorias/actions";

const initialState = { ok: false, error: null };

/**
 * @param {{
 *   categoria?: {
 *     id_categoria: string,
 *     id_rubro: string,
 *     nombre_categoria: string,
 *     activo: boolean,
 *     rubro?: { id_rubro: string, nombre_rubro: string, activo: boolean } | null,
 *   } | null,
 *   rubros: Array<{ id_rubro: string, nombre_rubro: string, activo: boolean }>,
 * }} props
 */
export function CategoriaForm({ categoria = null, rubros }) {
  const router = useRouter();
  const isEdit = Boolean(categoria?.id_categoria);

  // En edición, asegurar que el rubro actual aparezca aunque esté inactivo.
  const rubrosOpciones = [...rubros];
  if (
    isEdit &&
    categoria?.id_rubro &&
    !rubrosOpciones.some((r) => r.id_rubro === categoria.id_rubro)
  ) {
    rubrosOpciones.unshift({
      id_rubro: categoria.id_rubro,
      nombre_rubro:
        categoria.rubro?.nombre_rubro ??
        `Rubro ${categoria.id_rubro.slice(0, 8)}… (inactivo)`,
      activo: categoria.rubro?.activo ?? false,
    });
  }

  async function submitAction(_prev, formData) {
    if (isEdit) {
      return actualizarCategoria(categoria.id_categoria, formData);
    }
    return crearCategoria(formData);
  }

  const [state, formAction, pending] = useActionState(
    submitAction,
    initialState
  );

  useEffect(() => {
    if (state?.ok) {
      router.push("/categorias");
      router.refresh();
    }
  }, [state, router]);

  if (!rubrosOpciones.length) {
    return (
      <div className="palacio-card max-w-xl border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
        <p className="font-medium">No hay rubros activos</p>
        <p className="mt-1 text-amber-900/80">
          Primero registrá al menos un rubro activo.
        </p>
        <Link
          href="/rubros/nuevo"
          className="mt-3 inline-flex font-medium text-palacio-red underline underline-offset-2"
        >
          Ir a crear un rubro
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="palacio-card max-w-xl p-5 md:p-6">
      <h2 className="mb-5 text-sm font-semibold text-zinc-900">
        {isEdit ? "Datos de la categoría" : "Alta de categoría"}
      </h2>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="id_rubro"
            className="text-sm font-medium text-zinc-800"
          >
            Rubro <span className="text-palacio-red">*</span>
          </label>
          <select
            id="id_rubro"
            name="id_rubro"
            required
            defaultValue={categoria?.id_rubro ?? ""}
            className="palacio-input"
          >
            <option value="" disabled>
              Seleccioná un rubro…
            </option>
            {rubrosOpciones.map((r) => (
              <option key={r.id_rubro} value={r.id_rubro}>
                {r.nombre_rubro}
                {r.activo === false ? " (inactivo)" : ""}
              </option>
            ))}
          </select>
          <p className="text-xs text-palacio-muted">
            Toda categoría debe pertenecer a un rubro existente.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="nombre_categoria"
            className="text-sm font-medium text-zinc-800"
          >
            Nombre <span className="text-palacio-red">*</span>
          </label>
          <input
            id="nombre_categoria"
            name="nombre_categoria"
            type="text"
            required
            defaultValue={categoria?.nombre_categoria ?? ""}
            className="palacio-input"
            placeholder="Ej. Chicles"
          />
          <p className="text-xs text-palacio-muted">
            Subclasificación dentro del rubro. No puede repetirse en el mismo
            rubro.
          </p>
        </div>

        <label className="flex items-center gap-2.5 text-sm text-zinc-800">
          <input
            type="checkbox"
            name="activo"
            value="true"
            defaultChecked={categoria?.activo ?? true}
            className="size-4 rounded border-zinc-300 accent-palacio-red"
          />
          Categoría activa
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
                : "Crear categoría"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/categorias")}
            className="palacio-btn-secondary px-4 py-2.5 text-sm"
          >
            Cancelar
          </button>
        </div>
      </div>
    </form>
  );
}
