import { listarListasPrecio } from "@/lib/listas-precio/actions";
import { ListaPrecioForm } from "@/components/listas-precio/ListaPrecioForm";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Nueva lista de precios | Palacio · ERP",
};

export default async function NuevaListaPrecioPage() {
  const { data, error } = await listarListasPrecio();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[
          { label: "Ventas" },
          { label: "Listas de precios", href: "/ventas/listas-de-precios" },
          { label: "Nueva" },
        ]}
        title="Nueva lista de precios"
        description="Las fechas son inclusivas y no pueden superponerse con otra lista del mismo tipo. Podés partir de una lista existente aplicando un ajuste porcentual."
      />

      {error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudieron cargar los datos del formulario</p>
          <p className="mt-1 text-amber-900/80">{error}</p>
        </div>
      ) : (
        <ListaPrecioForm listasOrigen={data ?? []} />
      )}
    </div>
  );
}
