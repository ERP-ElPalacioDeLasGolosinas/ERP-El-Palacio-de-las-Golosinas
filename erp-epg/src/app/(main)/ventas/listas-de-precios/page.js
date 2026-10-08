import { listarListasPrecio } from "@/lib/listas-precio/actions";
import { ESTADOS_LISTA, TIPOS_LISTA } from "@/lib/listas-precio/constantes";
import { ListasPrecioTable } from "@/components/listas-precio/ListasPrecioTable";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Listas de precios | Palacio · ERP",
};

/**
 * @param {{ searchParams: Promise<{ tipo?: string, estado?: string }> }} props
 */
export default async function ListasPreciosPage({ searchParams }) {
  const sp = await searchParams;
  const filtros = {
    tipo: TIPOS_LISTA.includes(sp?.tipo) ? sp.tipo : "",
    estado: ESTADOS_LISTA.includes(sp?.estado) ? sp.estado : "",
  };

  const { data, error } = await listarListasPrecio(filtros);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[{ label: "Ventas" }, { label: "Listas de precios" }]}
        title="Listas de precios"
        description="Precios por artículo según el tipo de lista. Solo puede haber una lista vigente por tipo; un artículo sin precio en la lista vigente no se puede vender."
      />

      {error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudieron cargar las listas</p>
          <p className="mt-1 text-amber-900/80">{error}</p>
        </div>
      ) : (
        <ListasPrecioTable listas={data ?? []} filtros={filtros} />
      )}
    </div>
  );
}
