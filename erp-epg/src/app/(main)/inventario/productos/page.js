import { listarProductos } from "@/lib/productos/actions";
import { listarMarcas } from "@/lib/marcas/actions";
import { listarCategorias } from "@/lib/categorias/actions";
import { listarRubros } from "@/lib/rubros/actions";
import { listarUnidadesMedida } from "@/lib/unidades-medida/actions";
import { ProductosTable } from "@/components/productos/ProductosTable";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Productos | Palacio · ERP",
};

/**
 * @param {{ searchParams: Promise<{ inactivos?: string }> }} props
 */
export default async function ProductosPage({ searchParams }) {
  const sp = await searchParams;
  const incluirInactivos = sp?.inactivos === "1";

  const [
    { data, error },
    marcasRes,
    categoriasRes,
    rubrosRes,
    unidadesRes,
  ] = await Promise.all([
    listarProductos(incluirInactivos),
    listarMarcas(false),
    listarCategorias(false),
    listarRubros(false),
    listarUnidadesMedida(false),
  ]);

  const marcas = (marcasRes.data ?? []).map((m) => ({
    id_marca: m.id_marca,
    nombre_marca: m.nombre_marca,
  }));
  const categorias = (categoriasRes.data ?? []).map((c) => ({
    id_categoria: c.id_categoria,
    nombre_categoria: c.nombre_categoria,
    nombre_rubro: c.nombre_rubro,
  }));
  const rubros = (rubrosRes.data ?? []).map((r) => ({
    id_rubro: r.id_rubro,
    nombre_rubro: r.nombre_rubro,
  }));
  const unidades = (unidadesRes.data ?? []).map((u) => ({
    id_unidad_medida: u.id_unidad_medida,
    nombre: u.nombre,
    abreviatura: u.abreviatura,
  }));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[{ label: "Inventario" }, { label: "Productos" }]}
        title="Productos"
        description="Catálogo de artículos (A-05): alta, edición y administración."
      />

      {error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudieron cargar los productos</p>
          <p className="mt-1 text-amber-900/80">{error}</p>
        </div>
      ) : (
        <ProductosTable
          productos={data ?? []}
          marcas={marcas}
          categorias={categorias}
          rubros={rubros}
          unidades={unidades}
          incluirInactivos={incluirInactivos}
        />
      )}
    </div>
  );
}
