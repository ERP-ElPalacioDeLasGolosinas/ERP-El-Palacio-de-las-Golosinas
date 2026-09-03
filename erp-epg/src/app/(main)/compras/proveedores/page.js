import { listarProveedores } from "@/lib/proveedores/actions";
import { ProveedoresTable } from "@/components/proveedores/ProveedoresTable";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Proveedores | Palacio · ERP",
};

/**
 * @param {{ searchParams: Promise<{ inactivos?: string }> }} props
 */
export default async function ProveedoresPage({ searchParams }) {
  const sp = await searchParams;
  const incluirInactivos = sp?.inactivos === "1";

  const { data, error } = await listarProveedores(incluirInactivos);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[{ label: "Compras" }, { label: "Proveedores" }]}
        title="Proveedores"
        description="Alta, edición y administración de proveedores."
      />

      {error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudieron cargar los proveedores</p>
          <p className="mt-1 text-amber-900/80">{error}</p>
        </div>
      ) : (
        <ProveedoresTable
          proveedores={data ?? []}
          incluirInactivos={incluirInactivos}
        />
      )}
    </div>
  );
}
