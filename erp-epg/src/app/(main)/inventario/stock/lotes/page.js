import Link from "next/link";
import { listarLotesRecientes } from "@/lib/stock/actions";
import { listarDepositos } from "@/lib/depositos/actions";
import { LotesRecientesTable } from "@/components/stock/LotesRecientesTable";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Lotes | Palacio · ERP",
};

/**
 * @param {{ searchParams: Promise<{ deposito?: string }> }} props
 */
export default async function LotesPage({ searchParams }) {
  const sp = (await searchParams) ?? {};
  const idDeposito = sp.deposito ?? null;

  const [{ data, error }, depositosRes] = await Promise.all([
    listarLotesRecientes(idDeposito),
    listarDepositos(false),
  ]);

  const depositos = (depositosRes.data ?? []).map((d) => ({
    id_deposito: d.id_deposito,
    nombre_deposito: d.nombre_deposito,
  }));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[
          { label: "Inventario" },
          { label: "Stock", href: "/inventario/stock" },
          { label: "Lotes" },
        ]}
        title="Últimos lotes ingresados"
        description="Historial de lotes por producto y depósito, del más reciente al más antiguo."
        actions={
          <Link
            href="/inventario/stock/lotes/nuevo"
            className="palacio-btn-primary inline-flex px-4 py-2.5 text-sm"
          >
            Registrar lote
          </Link>
        }
      />

      {error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudieron cargar los lotes</p>
          <p className="mt-1 text-amber-900/80">{error}</p>
        </div>
      ) : (
        <LotesRecientesTable
          filas={data ?? []}
          depositos={depositos}
          filtroDeposito={idDeposito ?? ""}
        />
      )}
    </div>
  );
}
