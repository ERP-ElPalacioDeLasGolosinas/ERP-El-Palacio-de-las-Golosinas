import { notFound } from "next/navigation";
import {
  obtenerComprobante,
  listarDetalleComprobante,
  listarOrdenesPagoComprobante,
} from "@/lib/comprobantes/actions";
import { ComprobanteDetalle } from "@/components/comprobantes/ComprobanteDetalle";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Detalle del comprobante | Palacio · ERP",
};

/**
 * @param {{ params: Promise<{ id: string }> }} props
 */
export default async function ComprobanteDetallePage({ params }) {
  const { id } = await params;

  const [cabeceraRes, lineasRes, ordenesRes] = await Promise.all([
    obtenerComprobante(id),
    listarDetalleComprobante(id),
    listarOrdenesPagoComprobante(id),
  ]);

  if (!cabeceraRes.data) {
    if (cabeceraRes.error) {
      return (
        <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8">
          <PageHeader
            crumbs={[
              { label: "Compras" },
              { label: "Comprobantes", href: "/compras/comprobantes" },
              { label: "Detalle" },
            ]}
            title="Detalle del comprobante"
          />
          <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
            <p className="font-medium">No se pudo cargar el comprobante</p>
            <p className="mt-1 text-amber-900/80">{cabeceraRes.error}</p>
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
          { label: "Compras" },
          { label: "Comprobantes", href: "/compras/comprobantes" },
          { label: cabeceraRes.data.numero_formateado ?? "Detalle" },
        ]}
        title="Detalle del comprobante"
        description="Cabecera, líneas y control de coincidencia entre la suma del detalle y el importe total."
      />

      <ComprobanteDetalle
        comprobante={cabeceraRes.data}
        lineas={lineasRes.data ?? []}
        errorLineas={lineasRes.error}
        ordenesPago={ordenesRes.data ?? []}
      />
    </div>
  );
}
