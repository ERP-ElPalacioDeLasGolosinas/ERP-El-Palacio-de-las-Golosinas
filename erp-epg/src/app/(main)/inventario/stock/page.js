import Link from "next/link";
import { consultarStockResumen } from "@/lib/stock/actions";
import { listarProductos } from "@/lib/productos/actions";
import { listarMarcas } from "@/lib/marcas/actions";
import { listarCategorias } from "@/lib/categorias/actions";
import { listarRubros } from "@/lib/rubros/actions";
import { StockResumenTable } from "@/components/stock/StockResumenTable";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Stock | Palacio · ERP",
};

/**
 * @param {{ searchParams: Promise<{ q?: string }> }} props
 */
export default async function StockPage({ searchParams }) {
  const sp = (await searchParams) ?? {};
  const q = (sp.q ?? "").trim();

  const [
    { data, error },
    productosRes,
    marcasRes,
    categoriasRes,
    rubrosRes,
  ] = await Promise.all([
    consultarStockResumen(q || null),
    listarProductos(false),
    listarMarcas(false),
    listarCategorias(false),
    listarRubros(false),
  ]);

  const metaByProducto = new Map(
    (productosRes.data ?? []).map((p) => [
      p.id_producto,
      {
        id_marca: p.id_marca ?? null,
        id_categoria: p.id_categoria ?? null,
        id_rubro: p.id_rubro ?? null,
      },
    ])
  );

  const filas = (data ?? []).map((f) => {
    const meta = metaByProducto.get(f.id_producto) ?? {};
    return {
      ...f,
      id_marca: meta.id_marca ?? null,
      id_categoria: meta.id_categoria ?? null,
      id_rubro: meta.id_rubro ?? null,
    };
  });

  const marcas = (marcasRes.data ?? []).map((m) => ({
    id_marca: m.id_marca,
    nombre_marca: m.nombre_marca,
  }));
  const categorias = (categoriasRes.data ?? []).map((c) => ({
    id_categoria: c.id_categoria,
    nombre_categoria: c.nombre_categoria,
  }));
  const rubros = (rubrosRes.data ?? []).map((r) => ({
    id_rubro: r.id_rubro,
    nombre_rubro: r.nombre_rubro,
  }));

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[{ label: "Inventario" }, { label: "Stock" }]}
        title="Consultar stock"
        description="Stock total por producto. Entrá a un producto para ver el desglose por depósito y sus lotes."
        actions={
          <Link
            href="/inventario/stock/lotes/nuevo"
            className="palacio-btn-primary inline-flex px-4 py-2.5 text-sm"
          >
            Registrar lote
          </Link>
        }
      />

      {error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudo cargar el stock</p>
          <p className="mt-1 text-amber-900/80">{error}</p>
        </div>
      ) : (
        <StockResumenTable
          filas={filas}
          busquedaInicial={q}
          marcas={marcas}
          categorias={categorias}
          rubros={rubros}
        />
      )}
    </div>
  );
}
