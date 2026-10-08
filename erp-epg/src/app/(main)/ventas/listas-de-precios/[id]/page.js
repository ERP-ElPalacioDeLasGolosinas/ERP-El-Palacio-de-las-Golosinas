import { notFound } from "next/navigation";
import { obtenerListaPrecio } from "@/lib/listas-precio/actions";
import { listarProductos } from "@/lib/productos/actions";
import { ListaPrecioDetalle } from "@/components/listas-precio/ListaPrecioDetalle";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Lista de precios | Palacio · ERP",
};

/**
 * @param {{ params: Promise<{ id: string }> }} props
 */
export default async function ListaPrecioDetallePage({ params }) {
  const { id } = await params;
  const [{ data, error }, productosRes] = await Promise.all([
    obtenerListaPrecio(id),
    listarProductos(false),
  ]);

  const crumbsBase = [
    { label: "Ventas" },
    { label: "Listas de precios", href: "/ventas/listas-de-precios" },
  ];

  if (!data) {
    if (error) {
      return (
        <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
          <PageHeader crumbs={[...crumbsBase, { label: "Detalle" }]} title="Lista de precios" />
          <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
            <p className="font-medium">No se pudo cargar la lista</p>
            <p className="mt-1 text-amber-900/80">{error}</p>
          </div>
        </div>
      );
    }
    notFound();
  }

  const productos = (productosRes.data ?? []).map((p) => ({
    id_producto: p.id_producto,
    codigo_producto: p.codigo_producto,
    nombre_producto: p.nombre_producto,
  }));

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[...crumbsBase, { label: data.nombre_lista_precio }]}
        title={data.nombre_lista_precio}
        description={`Lista ${data.tipo_lista}. Los cambios de precio no alteran las ventas ya registradas.`}
      />
      <ListaPrecioDetalle
        key={`${data.id_lista_precio}-${data.editado}`}
        lista={data}
        productos={productos}
      />
    </div>
  );
}
