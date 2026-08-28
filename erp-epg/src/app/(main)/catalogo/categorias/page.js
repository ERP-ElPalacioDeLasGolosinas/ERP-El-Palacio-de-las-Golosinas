import { listarCategorias } from "@/lib/categorias/actions";
import { listarRubros } from "@/lib/rubros/actions";
import { CategoriasTable } from "@/components/categorias/CategoriasTable";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Categorías | Palacio · ERP",
};

/**
 * @param {{ searchParams: Promise<{ inactivos?: string }> }} props
 */
export default async function CategoriasPage({ searchParams }) {
  const sp = await searchParams;
  const incluirInactivos = sp?.inactivos === "1";

  const [{ data, error }, rubrosResult] = await Promise.all([
    listarCategorias(incluirInactivos),
    listarRubros(false),
  ]);

  const rubros = (rubrosResult.data ?? []).map((r) => ({
    id_rubro: r.id_rubro,
    nombre_rubro: r.nombre_rubro,
  }));

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[{ label: "Catálogo" }, { label: "Categorías" }]}
        title="Categorías"
        description="Alta, edición y administración de las categorías del catálogo. Cada categoría pertenece a un rubro."
      />

      {error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudieron cargar las categorías</p>
          <p className="mt-1 text-amber-900/80">{error}</p>
        </div>
      ) : rubros.length === 0 ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No hay rubros activos</p>
          <p className="mt-1 text-amber-900/80">
            Toda categoría necesita un rubro. Creá al menos un rubro activo en{" "}
            <span className="font-medium">Catálogo → Rubros</span> antes de cargar
            categorías.
          </p>
        </div>
      ) : (
        <CategoriasTable
          categorias={data ?? []}
          rubros={rubros}
          incluirInactivos={incluirInactivos}
        />
      )}
    </div>
  );
}
