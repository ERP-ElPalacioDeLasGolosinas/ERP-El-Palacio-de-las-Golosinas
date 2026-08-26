import { CategoriaForm } from "@/components/categorias/CategoriaForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { listarRubrosParaCategoria } from "@/lib/categorias/actions";
import Link from "next/link";

export const metadata = {
  title: "Nueva categoría | Palacio · ERP",
};

export default async function NuevaCategoriaPage() {
  const { data: rubros, error } = await listarRubrosParaCategoria();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[
          { label: "Inicio", href: "/" },
          { label: "Categorías", href: "/categorias" },
          { label: "Nueva" },
        ]}
        title="Nueva categoría"
        description="Seleccioná el rubro y registrá la categoría asociada."
      />

      {error ? (
        <div className="card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudieron cargar los rubros</p>
          <p className="mt-1 text-amber-900/80">{error}</p>
          <p className="mt-2 text-amber-900/70">
            Necesitás tener rubros cargados.{" "}
            <Link href="/rubros" className="font-medium underline">
              Ir a rubros
            </Link>
            .
          </p>
        </div>
      ) : (
        <CategoriaForm rubros={rubros ?? []} />
      )}
    </div>
  );
}
