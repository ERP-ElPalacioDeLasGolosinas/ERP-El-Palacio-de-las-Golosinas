"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { cambiarEstadoTicket, responderTicketPersonal } from "@/lib/tickets/actions";
import { ESTADOS_TICKET } from "@/lib/tickets/estado";
import EstadoTicketBadge from "@/components/tienda/EstadoTicketBadge";

const fechaFmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" });

/**
 * @param {{ ticket: Record<string, any> }} props
 */
export function TicketDetalle({ ticket }) {
  const [state, formAction, pending] = useActionState(responderTicketPersonal, { error: null, ok: false });
  const [errorEstado, setErrorEstado] = useState(null);
  const [cambiando, startTransition] = useTransition();
  const formRef = useRef(null);
  const cerrado = ticket.estado === "Cerrado";

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  function cambiarEstado(estado) {
    setErrorEstado(null);
    startTransition(async () => {
      const res = await cambiarEstadoTicket(ticket.id_ticket, estado);
      if (!res.ok) setErrorEstado(res.error);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <section>
        <ul className="space-y-3">
          {ticket.mensajes.map((m, i) => {
            const propio = m.autor === "Personal";
            return (
              <li key={i} className={`flex ${propio ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-xl border p-3 text-sm ${
                    propio ? "border-palacio-primary/30 bg-white" : "border-zinc-200 bg-zinc-50"
                  }`}
                >
                  <p className="text-xs font-semibold text-palacio-muted">
                    {propio ? "Personal" : ticket.nombre_cliente}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{m.mensaje}</p>
                  <p className="mt-1 text-xs text-palacio-muted">{fechaFmt.format(new Date(m.fecha))}</p>
                </div>
              </li>
            );
          })}
        </ul>

        {cerrado ? (
          <p className="mt-4 text-sm text-palacio-muted">El ticket está cerrado y no admite más respuestas.</p>
        ) : (
          <form ref={formRef} action={formAction} className="palacio-card mt-4 flex flex-col gap-3 p-4">
            {state?.error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {state.error}
              </p>
            ) : null}
            <input type="hidden" name="id_ticket" value={ticket.id_ticket} />
            <label className="flex flex-col gap-1 text-sm">
              Respuesta al cliente
              <textarea name="mensaje" required maxLength={2000} rows={4} className="palacio-input" />
            </label>
            <button type="submit" disabled={pending} className="palacio-btn-primary self-end px-5 py-2.5 text-sm">
              {pending ? "Enviando…" : "Responder"}
            </button>
          </form>
        )}
      </section>

      <aside className="palacio-card h-fit space-y-3 p-4 text-sm">
        <div>
          <p className="text-xs font-medium text-palacio-muted">Estado</p>
          <p className="mt-1">
            <EstadoTicketBadge estado={ticket.estado} />
          </p>
        </div>
        {!cerrado ? (
          <label className="flex flex-col gap-1 text-xs font-medium text-palacio-muted">
            Cambiar estado
            <select
              value={ticket.estado}
              disabled={cambiando}
              onChange={(e) => cambiarEstado(e.target.value)}
              className="palacio-input"
            >
              {ESTADOS_TICKET.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {errorEstado ? <p className="text-xs text-red-700">{errorEstado}</p> : null}
        <div>
          <p className="text-xs font-medium text-palacio-muted">Cliente</p>
          <p className="mt-1">{ticket.nombre_cliente}</p>
          <p className="text-palacio-muted">{ticket.mail_cliente}</p>
          {ticket.telefono_cliente ? <p className="text-palacio-muted">{ticket.telefono_cliente}</p> : null}
        </div>
        {ticket.id_pedido ? (
          <div>
            <p className="text-xs font-medium text-palacio-muted">Pedido</p>
            <p className="mt-1">
              <Link href={`/ventas/pedidos-web/${ticket.id_pedido}`}>N.º {ticket.numero_pedido}</Link>
            </p>
          </div>
        ) : null}
        <div>
          <p className="text-xs font-medium text-palacio-muted">Abierto</p>
          <p className="mt-1">{fechaFmt.format(new Date(ticket.creado))}</p>
        </div>
      </aside>
    </div>
  );
}
