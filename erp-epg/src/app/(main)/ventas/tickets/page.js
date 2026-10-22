import { listarTickets } from "@/lib/tickets/actions";
import { TicketsTable } from "@/components/tickets/TicketsTable";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Tickets | Palacio · ERP",
};

/**
 * @param {{ searchParams: Promise<{ estado?: string }> }} props
 */
export default async function TicketsPage({ searchParams }) {
  const sp = await searchParams;
  const estado = sp?.estado || null;

  const { data, error } = await listarTickets({ estado });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[{ label: "Ventas" }, { label: "Tickets" }]}
        title="Tickets de soporte"
        description="Consultas de los clientes de la tienda online. Filtrá por estado."
      />

      {error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudieron cargar los tickets</p>
          <p className="mt-1 text-amber-900/80">{error}</p>
        </div>
      ) : (
        <TicketsTable tickets={data ?? []} estado={estado ?? ""} />
      )}
    </div>
  );
}
