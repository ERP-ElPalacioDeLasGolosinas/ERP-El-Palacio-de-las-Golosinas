import { listarRubros } from "@/lib/rubros/actions";
import { RubrosTable } from "@/components/rubros/RubrosTable";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Rubros | Palacio · ERP",
};

/**
 * @param {{ searchParams: Promise<{ inactivos?: string }> }} props
 */
export default async function RubrosPage({ searchParams }) {
  const sp = await searchParams;
  const incluirInactivos = sp?.inactivos === "1";

  const { data, error } = await listarRubros(incluirInactivos);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[{ label: "Catálogo" }, { label: "Rubros" }]}
        title="Rubros"
        description="Alta, edición y administración de los rubros del catálogo (A-03)."
      />

      {error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudieron cargar los rubros</p>
          <p className="mt-1 text-amber-900/80">{error}</p>
        </div>
      ) : (
        <RubrosTable rubros={data ?? []} incluirInactivos={incluirInactivos} />
      )}
    </div>
  );
}
