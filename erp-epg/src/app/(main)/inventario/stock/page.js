import { consultarStock } from "@/lib/stock/actions";
import { StockTable } from "@/components/stock/StockTable";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Stock | Palacio · ERP",
};

export default async function StockPage() {
  const { data, error } = await consultarStock();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[{ label: "Stock" }]}
        title="Consultar stock"
        description="Stock disponible por producto y depósito (S-03)."
      />

      {error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudo cargar el stock</p>
          <p className="mt-1 text-amber-900/80">{error}</p>
        </div>
      ) : (
        <StockTable filas={data ?? []} />
      )}
    </div>
  );
}
