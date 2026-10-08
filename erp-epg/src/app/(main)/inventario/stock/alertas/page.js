import { PageHeader } from "@/components/layout/PageHeader";
import { AlertasStock } from "@/components/stock/AlertasStock";
import { listarDepositos } from "@/lib/depositos/actions";
import { listarAlertasStock } from "@/lib/stock/actions";

export const metadata = { title: "Alertas de stock | Palacio · ERP" };

/** @param {{ searchParams: Promise<{ deposito?: string }> }} props */
export default async function AlertasInventarioPage({ searchParams }) {
  const { deposito = "" } = await searchParams;
  const [alertasRes, depositosRes] = await Promise.all([
    listarAlertasStock(deposito || null),
    listarDepositos(false),
  ]);

  const depositos = (depositosRes.data ?? [])
    .filter((d) => d.activo !== false)
    .map((d) => ({ id_deposito: d.id_deposito, nombre_deposito: d.nombre_deposito }));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[
          { label: "Inventario" },
          { label: "Stock", href: "/inventario/stock" },
          { label: "Alertas" },
        ]}
        title="Alertas de stock"
        description="Artículos cuyo stock actual está en o por debajo del mínimo configurado para ese depósito."
      />
      {alertasRes.error ? (
        <div className="palacio-card border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {alertasRes.error}
        </div>
      ) : (
        <AlertasStock
          alertas={alertasRes.data ?? []}
          depositos={depositos}
          deposito={deposito}
        />
      )}
    </div>
  );
}
