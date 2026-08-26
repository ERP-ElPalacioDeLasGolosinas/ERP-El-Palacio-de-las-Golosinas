import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProductoForm } from "@/components/productos/ProductoForm";
import {
  listarCategoriasParaProducto,
  listarMarcasParaProducto,
  listarUnidadesMedidaParaProducto,
} from "@/lib/productos/actions";

export const metadata = {
  title: "Nuevo artículo | Palacio · ERP",
};

export default async function NuevoProductoPage() {
  const [
    { data: marcas, error: errorMarcas },
    { data: unidadesMedida, error: errorUnidades },
    { data: categorias, error: errorCategorias },
  ] = await Promise.all([
    listarMarcasParaProducto(),
    listarUnidadesMedidaParaProducto(),
    listarCategoriasParaProducto(),
  ]);

  const error = errorMarcas || errorUnidades || errorCategorias;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[
          { label: "Inicio", href: "/" },
          { label: "Artículos", href: "/productos" },
          { label: "Nuevo" },
        ]}
        title="Nuevo artículo"
        description="Completá los datos obligatorios para registrar el artículo en el catálogo."
      />

      {error ? (
        <div className="card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudieron cargar los datos necesarios</p>
          <p className="mt-1 text-amber-900/80">{error}</p>
          <p className="mt-2 text-amber-900/70">
            Necesitás tener marcas, unidades de medida y categorías cargadas.{" "}
            <Link href="/rubros" className="font-medium underline">
              Ir a rubros
            </Link>
            .
          </p>
        </div>
      ) : (
        <ProductoForm
          marcas={marcas ?? []}
          unidadesMedida={unidadesMedida ?? []}
          categorias={categorias ?? []}
        />
      )}
    </div>
  );
}
