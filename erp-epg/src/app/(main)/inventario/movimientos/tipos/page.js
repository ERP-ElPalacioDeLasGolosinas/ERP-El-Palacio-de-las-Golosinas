import { listarTiposMovimiento } from "@/lib/tipos-movimiento/actions";
import { TiposMovimientoTable } from "@/components/tipos-movimiento/TiposMovimientoTable";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Tipos de movimiento | Palacio · ERP",
};

/**
 * @param {{ searchParams: Promise<{ inactivas?: string }> }} props
 */
export default async function TiposMovimientoPage({ searchParams }) {
  const sp = await searchParams;
  const incluirInactivas = sp?.inactivas === "1";

  const { data, error } = await listarTiposMovimiento(incluirInactivas);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[
          { label: "Movimientos", href: "/inventario/movimientos" },
          { label: "Tipos" },
        ]}
        title="Tipos de movimiento"
        description="Alta, edición y administración de los tipos de movimiento de stock."
      />

      {error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">
            No se pudieron cargar los tipos de movimiento
          </p>
          <p className="mt-1 text-amber-900/80">{error}</p>
        </div>
      ) : (
        <TiposMovimientoTable
          tiposMovimiento={data ?? []}
          incluirInactivas={incluirInactivas}
        />
      )}
    </div>
  );
}
