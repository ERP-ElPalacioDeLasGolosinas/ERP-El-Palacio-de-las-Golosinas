"use client";

import { useActionState } from "react";
import { crearTicket } from "@/app/(tienda)/tienda/cuenta/actions";

const INPUT = "rounded-lg border border-zinc-300 px-3 py-2";

export default function TicketNuevoForm({ pedidos, idPedidoInicial }) {
  const [state, formAction, pending] = useActionState(crearTicket, { error: null });

  return (
    <form action={formAction} className="palacio-card flex flex-col gap-3 p-4">
      {state?.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      <label className="flex flex-col gap-1 text-sm">
        Asunto
        <input name="asunto" required maxLength={150} className={INPUT} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Pedido relacionado (opcional)
        <select name="id_pedido" defaultValue={idPedidoInicial ?? ""} className={INPUT}>
          <option value="">Ninguno</option>
          {pedidos.map((p) => (
            <option key={p.id_pedido} value={p.id_pedido}>
              Pedido N° {p.numero}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Mensaje
        <textarea name="mensaje" required maxLength={2000} rows={6} className={INPUT} />
      </label>
      <button type="submit" disabled={pending} className="palacio-btn-primary self-end px-5 py-2.5 text-sm">
        {pending ? "Enviando…" : "Enviar consulta"}
      </button>
    </form>
  );
}
