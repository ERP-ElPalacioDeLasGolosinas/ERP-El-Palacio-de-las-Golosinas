import { notFound } from "next/navigation";
import { obtenerPedidoWeb } from "@/lib/pedidos-web/actions";
import { PedidoWebDetalle } from "@/components/pedidos-web/PedidoWebDetalle";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Detalle del pedido web | Palacio · ERP",
};

/**
 * @param {{ params: Promise<{ id: string }> }} props
 */
export default async function PedidoWebDetallePage({ params }) {
  const { id } = await params;
  const { data, error } = await obtenerPedidoWeb(id);

  const crumbsBase = [
    { label: "Ventas" },
    { label: "Pedidos web", href: "/ventas/pedidos-web" },
  ];

  if (!data) {
    if (error) {
      return (
        <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
          <PageHeader crumbs={[...crumbsBase, { label: "Detalle" }]} title="Detalle del pedido web" />
          <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
            <p className="font-medium">No se pudo cargar el pedido</p>
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
        crumbs={[...crumbsBase, { label: `N.º ${data.numero}` }]}
        title={`Pedido web N.º ${data.numero}`}
        description="Datos del cliente, artículos y cambio de estado del pedido."
      />
      <PedidoWebDetalle pedido={data} />
    </div>
  );
}
