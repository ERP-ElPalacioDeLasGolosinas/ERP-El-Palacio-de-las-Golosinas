import { notFound } from "next/navigation";
import { obtenerOrdenPago } from "@/lib/ordenes-pago/actions";
import { OrdenPagoDetalle } from "@/components/ordenes-pago/OrdenPagoDetalle";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Detalle de la orden de pago | Palacio · ERP",
};

/**
 * @param {{ params: Promise<{ id: string }> }} props
 */
export default async function OrdenPagoDetallePage({ params }) {
  const { id } = await params;
  const { data, error } = await obtenerOrdenPago(id);

  if (!data) {
    if (error) {
      return (
        <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8">
          <PageHeader
            crumbs={[
              { label: "Tesorería" },
              { label: "Pagos", href: "/tesoreria/pagos" },
              { label: "Órdenes de pago", href: "/tesoreria/ordenes-de-pago" },
              { label: "Detalle" },
            ]}
            title="Detalle de la orden de pago"
          />
          <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
            <p className="font-medium">No se pudo cargar la orden de pago</p>
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
          { label: "Órdenes de pago", href: "/tesoreria/ordenes-de-pago" },
          { label: data.orden?.nombre_proveedor ?? "Detalle" },
        ]}
        title="Detalle de la orden de pago"
        description="Comprobantes imputados y medios de pago planificados. Confirmar o cancelar la orden."
      />

      <OrdenPagoDetalle
        orden={data.orden ?? {}}
        comprobantes={data.comprobantes ?? []}
        medios={data.medios ?? []}
      />
    </div>
  );
}
