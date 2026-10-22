"use client";

import { useActionState } from "react";
import { actualizarDatosCuenta } from "@/app/(tienda)/tienda/cuenta/actions";

const INPUT = "rounded-lg border border-zinc-300 px-3 py-2";

export default function DatosCuentaForm({ cliente }) {
  const [state, formAction, pending] = useActionState(actualizarDatosCuenta, { error: null, ok: false });

  return (
    <form action={formAction} className="palacio-card flex flex-col gap-3 p-4">
      {state?.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          Datos actualizados.
        </p>
      ) : null}
      <label className="flex flex-col gap-1 text-sm">
        Nombre
        <input name="nombre" required defaultValue={cliente.nombre_cliente ?? ""} className={INPUT} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          value={cliente.mail_cliente ?? ""}
          readOnly
          disabled
          className={`${INPUT} bg-zinc-100 text-palacio-muted`}
        />
        <span className="text-xs text-palacio-muted">El email no se puede modificar.</span>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        DNI o CUIT
        <input
          name="documento"
          required
          defaultValue={cliente.documento_cliente ?? ""}
          placeholder="12345678 o 20-12345678-9"
          className={INPUT}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Teléfono
        <input
          name="telefono"
          type="tel"
          required
          defaultValue={cliente.telefono_cliente ?? ""}
          placeholder="Solo números, sin espacios ni guiones"
          className={INPUT}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Dirección (opcional)
        <input name="direccion" defaultValue={cliente.direccion_cliente ?? ""} className={INPUT} />
      </label>
      <button type="submit" disabled={pending} className="palacio-btn-primary self-end px-5 py-2.5 text-sm">
        {pending ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
