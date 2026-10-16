"use client";

import { useActionState } from "react";
import { confirmarPedido } from "@/app/(tienda)/tienda/checkout/actions";

export default function ConfirmarPedido() {
  const [state, formAction, pending] = useActionState(
    async () => (await confirmarPedido()) ?? { error: null },
    { error: null }
  );

  return (
    <form action={formAction} className="mt-6 flex flex-col items-end gap-3">
      {state?.error ? (
        <p className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="palacio-btn-primary px-5 py-2.5 text-sm">
        {pending ? "Confirmando…" : "Confirmar pedido"}
      </button>
    </form>
  );
}
