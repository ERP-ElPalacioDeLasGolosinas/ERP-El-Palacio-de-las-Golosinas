import Link from "next/link";
import { listarLotesRecientes } from "@/lib/stock/actions";
import { listarDepositos } from "@/lib/depositos/actions";
import { listarProductos } from "@/lib/productos/actions";
import { listarMarcas } from "@/lib/marcas/actions";
import { listarCategorias } from "@/lib/categorias/actions";
import { listarRubros } from "@/lib/rubros/actions";
import { LotesRecientesTable } from "@/components/stock/LotesRecientesTable";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Lotes | Palacio · ERP",
};

/**
 * @param {{ searchParams: Promise<{ deposito?: string }> }} props
 */
export default async function LotesPage({ searchParams }) {
  const sp = (await searchParams) ?? {};
  const idDeposito = sp.deposito ?? null;

  const [
    { data, error },
    depositosRes,
    productosRes,
    marcasRes,
    categoriasRes,
    rubrosRes,
  ] = await Promise.all([
    listarLotesRecientes(idDeposito),
    listarDepositos(false),
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

  const depositos = (depositosRes.data ?? []).map((d) => ({
    id_deposito: d.id_deposito,
    nombre_deposito: d.nombre_deposito,
  }));
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
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[
          { label: "Inventario" },
          { label: "Stock", href: "/inventario/stock" },
          { label: "Lotes" },
        ]}
        title="Últimos lotes ingresados"
        description="Historial de lotes por producto y depósito, del más reciente al más antiguo."
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
          <p className="font-medium">No se pudieron cargar los lotes</p>
          <p className="mt-1 text-amber-900/80">{error}</p>
        </div>
      ) : (
        <LotesRecientesTable
          filas={filas}
          depositos={depositos}
          filtroDeposito={idDeposito ?? ""}
          marcas={marcas}
          categorias={categorias}
          rubros={rubros}
        />
      )}
    </div>
  );
}
