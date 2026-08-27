import { listarUnidadesMedida } from "@/lib/unidades-medida/actions";
import { UnidadesMedidaTable } from "@/components/unidades-medida/UnidadesMedidaTable";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Unidades de medida | Palacio · ERP",
};

/**
 * @param {{ searchParams: Promise<{ inactivas?: string }> }} props
 */
export default async function UnidadesMedidaPage({ searchParams }) {
  const sp = await searchParams;
  const incluirInactivas = sp?.inactivas === "1";

  const { data, error } = await listarUnidadesMedida(incluirInactivas);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[{ label: "Catálogo" }, { label: "Unidades de medida" }]}
        title="Unidades de medida"
        description="Alta, edición y administración de las unidades de medida del catálogo (A-01)."
      />

      {error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudieron cargar las unidades de medida</p>
          <p className="mt-1 text-amber-900/80">{error}</p>
        </div>
      ) : (
        <UnidadesMedidaTable
          unidades={data ?? []}
          incluirInactivas={incluirInactivas}
        />
      )}
    </div>
  );
}
