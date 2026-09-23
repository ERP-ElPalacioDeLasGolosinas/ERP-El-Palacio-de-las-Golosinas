import { notFound } from "next/navigation";
import { obtenerCobro } from "@/lib/cobros/actions";
import { CobroDetalle } from "@/components/cobros/CobroDetalle";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Detalle del cobro | Palacio · ERP",
};

/**
 * @param {{ params: Promise<{ id: string }> }} props
 */
export default async function CobroDetallePage({ params }) {
  const { id } = await params;
  const { data, error } = await obtenerCobro(id);

  const crumbsBase = [{ label: "Tesorería" }, { label: "Cobranzas", href: "/tesoreria/cobranzas" }];

  if (!data) {
    if (error) {
      return (
        <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8">
          <PageHeader crumbs={[...crumbsBase, { label: "Detalle" }]} title="Detalle del cobro" />
          <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
            <p className="font-medium">No se pudo cargar el cobro</p>
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
        crumbs={[...crumbsBase, { label: data.cobro?.nombre_cliente ?? "Detalle" }]}
        title="Detalle del cobro"
        description="Medios usados, cuentas imputadas y movimientos de tesorería generados. El cobro es inmutable."
      />
      <CobroDetalle
        cobro={data.cobro ?? {}}
        medios={data.medios ?? []}
        movimientos={data.movimientos ?? []}
      />
    </div>
  );
}
