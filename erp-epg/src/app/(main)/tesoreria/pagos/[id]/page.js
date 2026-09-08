import { notFound } from "next/navigation";
import { obtenerPago } from "@/lib/pagos/actions";
import { PagoDetalle } from "@/components/pagos/PagoDetalle";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Detalle del pago | Palacio · ERP",
};

/**
 * @param {{ params: Promise<{ id: string }> }} props
 */
export default async function PagoDetallePage({ params }) {
  const { id } = await params;
  const { data, error } = await obtenerPago(id);

  if (!data) {
    if (error) {
      return (
        <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8">
          <PageHeader
            crumbs={[
              { label: "Tesorería" },
              { label: "Pagos", href: "/tesoreria/pagos" },
              { label: "Detalle" },
            ]}
            title="Detalle del pago"
          />
          <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
            <p className="font-medium">No se pudo cargar el pago</p>
            <p className="mt-1 text-amber-900/80">{error}</p>
          </div>
        </div>
      );
    }
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[
          { label: "Tesorería" },
          { label: "Pagos", href: "/tesoreria/pagos" },
          { label: data.pago?.nombre_proveedor ?? "Detalle" },
        ]}
        title="Detalle del pago"
        description="Comprobantes cancelados, medios usados y movimientos de tesorería generados. El pago es inmutable."
      />

      <PagoDetalle
        pago={data.pago ?? {}}
        medios={data.medios ?? []}
        aplicaciones={data.aplicaciones ?? []}
        movimientos={data.movimientos ?? []}
      />
    </div>
  );
}
