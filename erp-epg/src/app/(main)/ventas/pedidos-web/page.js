import { listarPedidosWeb } from "@/lib/pedidos-web/actions";
import { PedidosWebTable } from "@/components/pedidos-web/PedidosWebTable";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Pedidos web | Palacio · ERP",
};

/**
 * @param {{ searchParams: Promise<{ estado?: string, desde?: string, hasta?: string }> }} props
 */
export default async function PedidosWebPage({ searchParams }) {
  const sp = await searchParams;
  const filtros = {
    estado: sp?.estado || null,
    desde: sp?.desde || null,
    hasta: sp?.hasta || null,
  };

  const { data, error } = await listarPedidosWeb(filtros);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[{ label: "Ventas" }, { label: "Pedidos web" }]}
        title="Pedidos web"
        description="Pedidos hechos desde la tienda online. Filtrá por estado y fecha de creación."
      />

      {error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudieron cargar los pedidos</p>
          <p className="mt-1 text-amber-900/80">{error}</p>
        </div>
      ) : (
        <PedidosWebTable
          pedidos={data ?? []}
          filtros={{
            estado: filtros.estado ?? "",
            desde: filtros.desde ?? "",
            hasta: filtros.hasta ?? "",
          }}
        />
      )}
    </div>
  );
}
