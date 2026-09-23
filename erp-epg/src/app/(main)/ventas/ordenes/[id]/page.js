import { notFound } from "next/navigation";
import { obtenerVenta } from "@/lib/ventas/actions";
import { VentaDetalle } from "@/components/ventas/VentaDetalle";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Detalle de la venta | Palacio · ERP",
};

/**
 * @param {{ params: Promise<{ id: string }> }} props
 */
export default async function VentaDetallePage({ params }) {
  const { id } = await params;
  const { data, error } = await obtenerVenta(id);

  const crumbsBase = [
    { label: "Ventas" },
    { label: "Ventas mayoristas", href: "/ventas/ordenes" },
  ];

  if (!data) {
    if (error) {
      return (
        <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
          <PageHeader crumbs={[...crumbsBase, { label: "Detalle" }]} title="Detalle de la venta" />
          <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
            <p className="font-medium">No se pudo cargar la venta</p>
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
        crumbs={[...crumbsBase, { label: data.venta?.numero_formateado ?? "Detalle" }]}
        title="Detalle de la venta"
        description="Comprobante, artículos con el depósito del que salieron y estado del cobro."
      />
      <VentaDetalle venta={data.venta ?? {}} detalle={data.detalle ?? []} cobro={data.cobro ?? null} />
    </div>
  );
}
