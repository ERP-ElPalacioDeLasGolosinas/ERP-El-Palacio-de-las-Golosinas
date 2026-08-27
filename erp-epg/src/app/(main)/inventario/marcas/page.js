import { listarMarcas } from "@/lib/marcas/actions";
import { MarcasTable } from "@/components/marcas/MarcasTable";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Marcas | Palacio · ERP",
};

/**
 * @param {{ searchParams: Promise<{ inactivas?: string }> }} props
 */
export default async function MarcasPage({ searchParams }) {
  const sp = await searchParams;
  // Sin query param: solo activas. Con ?inactivas=1: también inactivas.
  const incluirInactivas = sp?.inactivas === "1";

  const { data, error } = await listarMarcas(incluirInactivas);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[{ label: "Inventario" }, { label: "Marcas" }]}
        title="Marcas"
        description="Alta, edición y administración de las marcas del catálogo."
      />

      {error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudieron cargar las marcas</p>
          <p className="mt-1 text-amber-900/80">{error}</p>
        </div>
      ) : (
        <MarcasTable
          marcas={data ?? []}
          incluirInactivas={incluirInactivas}
        />
      )}
    </div>
  );
}
