import { notFound } from "next/navigation";
import { obtenerTicket } from "@/lib/tickets/actions";
import { TicketDetalle } from "@/components/tickets/TicketDetalle";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Detalle del ticket | Palacio · ERP",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @param {{ params: Promise<{ id: string }> }} props
 */
export default async function TicketDetallePage({ params }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const { data, error } = await obtenerTicket(id);
  const crumbsBase = [{ label: "Ventas" }, { label: "Tickets", href: "/ventas/tickets" }];

  if (!data) {
    if (error) {
      return (
        <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
          <PageHeader crumbs={[...crumbsBase, { label: "Detalle" }]} title="Detalle del ticket" />
          <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
            <p className="font-medium">No se pudo cargar el ticket</p>
            <p className="mt-1 text-amber-900/80">{error}</p>
          </div>
        </div>
      );
    }
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[...crumbsBase, { label: "Detalle" }]}
        title={data.asunto}
        description="Conversación con el cliente, respuesta y cambio de estado."
      />
      <TicketDetalle ticket={data} />
    </div>
  );
}
