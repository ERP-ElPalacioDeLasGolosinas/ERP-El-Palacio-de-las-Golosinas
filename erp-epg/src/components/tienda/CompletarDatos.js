"use client";

import { useActionState } from "react";
import { completarDatosCliente } from "@/app/(tienda)/tienda/checkout/actions";

export default function CompletarDatos({ documento, telefono, direccion }) {
  const [state, formAction, pending] = useActionState(completarDatosCliente, { error: null });

  return (
    <form action={formAction} className="palacio-card mt-2 flex flex-col gap-3 p-4">
      <p className="text-sm text-palacio-muted">
        Para finalizar el pedido necesitamos tu DNI/CUIT y un teléfono de contacto.
      </p>
      {state?.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      <label className="flex flex-col gap-1 text-sm">
        DNI o CUIT
        <input
          name="documento"
          required
          defaultValue={documento ?? ""}
          placeholder="12345678 o 20-12345678-9"
          className="rounded-lg border border-zinc-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Teléfono
        <input
          name="telefono"
          type="tel"
          required
          defaultValue={telefono ?? ""}
          placeholder="Solo números, sin espacios ni guiones"
          className="rounded-lg border border-zinc-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Dirección (opcional)
        <input
          name="direccion"
          defaultValue={direccion ?? ""}
          className="rounded-lg border border-zinc-300 px-3 py-2"
        />
      </label>
      <button type="submit" disabled={pending} className="palacio-btn-primary self-end px-5 py-2.5 text-sm">
        {pending ? "Guardando…" : "Guardar datos"}
      </button>
    </form>
  );
}
