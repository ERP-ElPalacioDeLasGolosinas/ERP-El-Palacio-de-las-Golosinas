"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ESTADOS_TICKET } from "@/lib/tickets/estado";
import EstadoTicketBadge from "@/components/tienda/EstadoTicketBadge";

const fechaFmt = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatFecha(valor) {
  if (!valor) return "—";
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? "—" : fechaFmt.format(d);
}

/**
 * @param {{ tickets: Array<Record<string, any>>, estado: string }} props
 */
export function TicketsTable({ tickets, estado }) {
  const router = useRouter();
  const pathname = usePathname();

  function setEstado(value) {
    router.push(value ? `${pathname}?estado=${encodeURIComponent(value)}` : pathname);
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-palacio-muted">
          Estado
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="palacio-input max-w-xs"
          >
            <option value="">Todos</option>
            {ESTADOS_TICKET.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </label>
      </div>

      {tickets.length === 0 ? (
        <div className="palacio-card px-6 py-12 text-center">
          <p className="text-sm text-palacio-muted">No hay tickets que coincidan con el filtro.</p>
        </div>
      ) : (
        <div className="palacio-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Listado</h2>
            <span className="text-xs text-palacio-muted">
              {tickets.length} ticket{tickets.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-palacio-border bg-zinc-50/80">
                  <Th>Asunto</Th>
                  <Th>Cliente</Th>
                  <Th>Pedido</Th>
                  <Th>Estado</Th>
                  <Th>Creado</Th>
                  <Th>Última actividad</Th>
                  <Th className="text-right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id_ticket} className="border-b border-palacio-border last:border-0">
                    <td className="max-w-xs truncate px-5 py-4 align-middle font-medium text-zinc-900">
                      {t.asunto}
                    </td>
                    <td className="px-5 py-4 align-middle text-zinc-700">{t.nombre_cliente}</td>
                    <td className="px-5 py-4 align-middle font-mono text-xs text-zinc-700">
                      {t.numero_pedido ?? "—"}
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <EstadoTicketBadge estado={t.estado} />
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">{formatFecha(t.creado)}</td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {formatFecha(t.ultima_actividad)}
                    </td>
                    <td className="px-5 py-4 text-right align-middle">
                      <Link
                        href={`/ventas/tickets/${t.id_ticket}`}
                        className="palacio-action-btn palacio-action-primary"
                      >
                        Ver ticket
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function Th({ children, className = "" }) {
  return (
    <th
      className={`px-5 py-3 text-[11px] font-semibold tracking-wider text-palacio-muted uppercase ${className}`}
    >
      {children}
    </th>
  );
}
