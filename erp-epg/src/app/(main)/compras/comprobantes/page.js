import { listarComprobantes } from "@/lib/comprobantes/actions";
import { ComprobantesTable } from "@/components/comprobantes/ComprobantesTable";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Comprobantes | Palacio · ERP",
};

export default async function ComprobantesPage() {
  const { data, error } = await listarComprobantes();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[{ label: "Compras" }, { label: "Comprobantes" }]}
        title="Comprobantes de proveedor"
        description="Historial de comprobantes registrados, con su saldo pendiente."
      />

      {error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudieron cargar los comprobantes</p>
          <p className="mt-1 text-amber-900/80">{error}</p>
        </div>
      ) : (
        <ComprobantesTable comprobantes={data ?? []} />
      )}
    </div>
  );
}
