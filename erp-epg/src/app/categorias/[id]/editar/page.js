import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoriaForm } from "@/components/categorias/CategoriaForm";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  listarRubrosParaCategoria,
  obtenerCategoria,
} from "@/lib/categorias/actions";

export const metadata = {
  title: "Editar categoría | Palacio · ERP",
};

/**
 * @param {{ params: Promise<{ id: string }> }} props
 */
export default async function EditarCategoriaPage({ params }) {
  const { id } = await params;
  const [{ data, error }, { data: rubros, error: rubrosError }] =
    await Promise.all([obtenerCategoria(id), listarRubrosParaCategoria()]);

  if (error) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
        <div className="palacio-card border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          Error al cargar: {error}
        </div>
        <Link
          href="/categorias"
          className="mt-4 inline-block text-sm font-medium text-palacio-red underline"
        >
          Volver a categorías
        </Link>
      </div>
    );
  }

  if (!data) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[
          { label: "Inicio", href: "/" },
          { label: "Categorías", href: "/categorias" },
          { label: "Editar" },
        ]}
        title="Editar categoría"
        description={data.nombre_categoria}
      />
      {rubrosError ? (
        <div className="mb-4 palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          No se pudieron recargar los rubros activos: {rubrosError}
        </div>
      ) : null}
      <CategoriaForm categoria={data} rubros={rubros ?? []} />
    </div>
  );
}
