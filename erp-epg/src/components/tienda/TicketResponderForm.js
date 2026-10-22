"use client";

import { useActionState, useEffect, useRef } from "react";
import { responderTicket } from "@/app/(tienda)/tienda/cuenta/actions";

const INPUT = "rounded-lg border border-zinc-300 px-3 py-2";

export default function TicketResponderForm({ idTicket }) {
  const [state, formAction, pending] = useActionState(responderTicket, { error: null, ok: false });
  const formRef = useRef(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="palacio-card mt-4 flex flex-col gap-3 p-4">
      {state?.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      <input type="hidden" name="id_ticket" value={idTicket} />
      <label className="flex flex-col gap-1 text-sm">
        Tu respuesta
        <textarea name="mensaje" required maxLength={2000} rows={4} className={INPUT} />
      </label>
      <button type="submit" disabled={pending} className="palacio-btn-primary self-end px-5 py-2.5 text-sm">
        {pending ? "Enviando…" : "Responder"}
      </button>
    </form>
  );
}
