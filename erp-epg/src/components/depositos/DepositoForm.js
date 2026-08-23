"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  actualizarDeposito,
  crearDeposito,
} from "@/lib/depositos/actions";

const initialState = { ok: false, error: null };

/**
 * @param {{ deposito?: {
 *   id_deposito: string,
 *   nombre_deposito: string,
 *   direccion_deposito: string | null,
 *   telefono_deposito: string | null,
 *   tipo_deposito: string | null,
 *   horario_apertura: string | null,
 *   horario_cierre: string | null,
 *   id_responsable: string | null,
 *   activo: boolean,
 *   esta_lleno: boolean,
 * } | null }} props
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
    <form action={formAction} className="palacio-card max-w-4xl p-5 md:p-6">
      <h2 className="mb-5 text-sm font-semibold text-zinc-900">
        {isEdit ? "Datos del depósito" : "Alta de depósito"}
      </h2>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nombre" htmlFor="nombre_deposito" required>
          <input
            id="nombre_deposito"
            name="nombre_deposito"
            type="text"
            required
            defaultValue={deposito?.nombre_deposito ?? ""}
            className="palacio-input"
            placeholder="Ej. Depósito Central"
          />
        </Field>

        <Field label="Teléfono" htmlFor="telefono_deposito" required>
          <input
            id="telefono_deposito"
            name="telefono_deposito"
            type="tel"
            required
            defaultValue={deposito?.telefono_deposito ?? ""}
            className="palacio-input"
            placeholder="Ej. 11 5555-5555"
          />
        </Field>

        <Field label="Dirección" htmlFor="direccion_deposito" required>
          <input
            id="direccion_deposito"
            name="direccion_deposito"
            type="text"
            required
            defaultValue={deposito?.direccion_deposito ?? ""}
            className="palacio-input"
            placeholder="Calle, número, localidad"
          />
        </Field>

        <Field label="Tipo de depósito" htmlFor="tipo_deposito" required>
          <select
            id="tipo_deposito"
            name="tipo_deposito"
            required
            defaultValue={deposito?.tipo_deposito ?? ""}
            className="palacio-input"
          >
            <option value="">Seleccionar tipo</option>
            <option value="Central">Central</option>
            <option value="Sucursal">Sucursal</option>
            <option value="Punto de Venta">Punto de Venta</option>
          </select>
        </Field>

        <Field label="Horario de apertura" htmlFor="horario_apertura" required>
          <input
            id="horario_apertura"
            name="horario_apertura"
            type="time"
            required
            defaultValue={formatTime(deposito?.horario_apertura)}
            className="palacio-input"
          />
        </Field>

        <Field label="Horario de cierre" htmlFor="horario_cierre" required>
          <input
            id="horario_cierre"
            name="horario_cierre"
            type="time"
            required
            defaultValue={formatTime(deposito?.horario_cierre)}
            className="palacio-input"
          />
        </Field>

        <Field label="Responsable" htmlFor="id_responsable" required>
          <input
            id="id_responsable"
            name="id_responsable"
            type="text"
            required
            defaultValue={deposito?.id_responsable ?? ""}
            className="palacio-input"
            placeholder="ID del usuario responsable"
          />
        </Field>

        <div className="flex flex-col justify-end gap-3 rounded-lg border border-palacio-border bg-zinc-50 px-4 py-3">
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
          <label className="flex items-center gap-2.5 text-sm text-zinc-800">
            <input
              type="checkbox"
              name="esta_lleno"
              value="true"
              defaultChecked={deposito?.esta_lleno ?? false}
              className="size-4 rounded border-zinc-300 accent-palacio-red"
            />
            Está lleno
          </label>
        </div>
      </div>

      {state?.error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-palacio-border pt-4">
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
    </form>
  );
}

function Field({ label, htmlFor, required = false, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-zinc-800">
        {label} {required ? <span className="text-palacio-red">*</span> : null}
      </label>
      {children}
    </div>
  );
}

function formatTime(value) {
  if (!value) {
    return "";
  }
  return String(value).slice(0, 5);
}
