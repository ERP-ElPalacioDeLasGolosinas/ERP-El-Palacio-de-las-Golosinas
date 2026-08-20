"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  actualizarDeposito,
  crearDeposito,
} from "@/lib/depositos/actions";

const initialState = { ok: false, error: null };

/**
 * @param {{ deposito?: { id_deposito: string, nombre_deposito: string, direccion_deposito: string | null, activo: boolean } | null }} props
 */
export function DepositoForm({ deposito = null }) {
  const router = useRouter();
  const isEdit = Boolean(deposito?.id_deposito);

  async function submitAction(_prev, formData) {
    if (isEdit) {
      return actualizarDeposito(deposito.id_deposito, formData);
    }
    return crearDeposito(formData);
  }

  const [state, formAction, pending] = useActionState(
    submitAction,
    initialState
  );

  useEffect(() => {
    if (state?.ok) {
      router.push("/depositos");
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction} className="palacio-card max-w-xl p-5 md:p-6">
      <h2 className="mb-5 text-sm font-semibold text-zinc-900">
        {isEdit ? "Datos del depósito" : "Alta de depósito"}
      </h2>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="nombre_deposito"
            className="text-sm font-medium text-zinc-800"
          >
            Nombre <span className="text-palacio-red">*</span>
          </label>
          <input
            id="nombre_deposito"
            name="nombre_deposito"
            type="text"
            required
            defaultValue={deposito?.nombre_deposito ?? ""}
            className="palacio-input"
            placeholder="Ej. Depósito Central"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="direccion_deposito"
            className="text-sm font-medium text-zinc-800"
          >
            Dirección
          </label>
          <input
            id="direccion_deposito"
            name="direccion_deposito"
            type="text"
            defaultValue={deposito?.direccion_deposito ?? ""}
            className="palacio-input"
            placeholder="Calle, número, localidad"
          />
        </div>

        <label className="flex items-center gap-2.5 text-sm text-zinc-800">
          <input
            type="checkbox"
            name="activo"
            value="true"
            defaultChecked={deposito?.activo ?? true}
            className="size-4 rounded border-zinc-300 accent-palacio-red"
          />
          Depósito activo
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
                : "Crear depósito"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/depositos")}
            className="palacio-btn-secondary px-4 py-2.5 text-sm"
          >
            Cancelar
          </button>
        </div>
      </div>
    </form>
  );
}
