import Link from "next/link";
import { consultarStockResumen } from "@/lib/stock/actions";
import { StockResumenTable } from "@/components/stock/StockResumenTable";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Stock | Palacio · ERP",
};

/**
 * @param {{ searchParams: Promise<{ q?: string }> }} props
 */
export default async function StockPage({ searchParams }) {
  const sp = (await searchParams) ?? {};
  const q = (sp.q ?? "").trim();

  const { data, error } = await consultarStockResumen(q || null);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[{ label: "Inventario" }, { label: "Stock" }]}
        title="Consultar stock"
        description="Stock total por producto. Entrá a un producto para ver el desglose por depósito y sus lotes."
        actions={
          <>
            <Link
              href="/inventario/stock/lotes"
              className="palacio-btn-secondary inline-flex px-4 py-2.5 text-sm"
            >
              Ver lotes
            </Link>
            <Link
              href="/inventario/stock/lotes/nuevo"
              className="palacio-btn-primary inline-flex px-4 py-2.5 text-sm"
            >
              Registrar lote
            </Link>
          </>
        }
      />

      {error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudo cargar el stock</p>
          <p className="mt-1 text-amber-900/80">{error}</p>
        </div>
      ) : (
        <StockResumenTable filas={data ?? []} busquedaInicial={q} />
      )}
    </div>
  );
}
