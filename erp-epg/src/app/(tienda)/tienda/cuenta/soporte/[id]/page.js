import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EstadoTicketBadge from "@/components/tienda/EstadoTicketBadge";
import TicketResponderForm from "@/components/tienda/TicketResponderForm";

export const metadata = { title: "Consulta — El Palacio de las Golosinas" };

const fechaFmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function DetalleTicket({ params }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_ticket_mi_obtener", { p_id_ticket: id });
  if (error) {
    return <p className="text-palacio-muted">No se pudo cargar la consulta. Probá de nuevo en un rato.</p>;
  }
  const ticket = Array.isArray(data) ? data[0] : data;
  if (!ticket) notFound();

  return (
    <div>
      <p className="text-sm"><Link href="/tienda/cuenta/soporte">← Soporte</Link></p>
      <h2 className="mt-3 text-lg font-semibold">{ticket.asunto}</h2>
      <p className="mt-1 text-sm text-palacio-muted">
        {ticket.numero_pedido ? (
          <>
            <Link href={`/tienda/cuenta/pedidos/${ticket.id_pedido}`}>Pedido N° {ticket.numero_pedido}</Link>
            {" · "}
          </>
        ) : null}
        Abierta el {fechaFmt.format(new Date(ticket.creado))}
      </p>
      <p className="mt-3">
        Estado: <EstadoTicketBadge estado={ticket.estado} />
      </p>

      <ul className="mt-4 space-y-3">
        {ticket.mensajes.map((m, i) => {
          const propio = m.autor === "Cliente";
          return (
            <li key={i} className={`flex ${propio ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-xl border p-3 text-sm ${
                  propio ? "border-zinc-200 bg-zinc-50" : "border-palacio-primary/30 bg-white"
                }`}
              >
                <p className="text-xs font-semibold text-palacio-muted">{propio ? "Vos" : "El Palacio de las Golosinas"}</p>
                <p className="mt-1 whitespace-pre-wrap">{m.mensaje}</p>
                <p className="mt-1 text-xs text-palacio-muted">{fechaFmt.format(new Date(m.fecha))}</p>
              </div>
            </li>
          );
        })}
      </ul>

      {ticket.estado === "Cerrado" ? (
        <p className="mt-4 text-sm text-palacio-muted">
          Esta consulta está cerrada. Si necesitás algo más, <Link href="/tienda/cuenta/soporte/nuevo">abrí una nueva</Link>.
        </p>
      ) : (
        <TicketResponderForm idTicket={ticket.id_ticket} />
      )}
    </div>
  );
}
