import { consultarStock } from "@/lib/stock/actions";
import { listarProductos } from "@/lib/productos/actions";
import { listarDepositos } from "@/lib/depositos/actions";
import { StockTable } from "@/components/stock/StockTable";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Stock | Palacio · ERP",
};

/**
 * @param {{ searchParams: Promise<{ producto?: string, deposito?: string }> }} props
 */
export default async function StockPage({ searchParams }) {
  const sp = (await searchParams) ?? {};
  const filtros = {
    id_producto: sp.producto ?? null,
    id_deposito: sp.deposito ?? null,
  };

  const [{ data, error }, productosRes, depositosRes] = await Promise.all([
    consultarStock(filtros),
    listarProductos(false),
    listarDepositos(false),
  ]);

  const productos = (productosRes.data ?? []).map((p) => ({
    id_producto: p.id_producto,
    nombre_completo: p.nombre_completo ?? p.nombre_producto,
  }));
  const depositos = (depositosRes.data ?? []).map((d) => ({
    id_deposito: d.id_deposito,
    nombre_deposito: d.nombre_deposito,
  }));

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[{ label: "Inventario" }, { label: "Stock" }]}
        title="Consultar stock"
        description="Stock disponible por producto y depósito."
      />

      {error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudo cargar el stock</p>
          <p className="mt-1 text-amber-900/80">{error}</p>
        </div>
      ) : (
        <StockTable
          filas={data ?? []}
          productos={productos}
          depositos={depositos}
          filtros={{
            producto: sp.producto ?? "",
            deposito: sp.deposito ?? "",
          }}
        />
      )}
    </div>
  );
}
