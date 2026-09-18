import { listarTiposCliente } from "@/lib/tipos-cliente/actions";
import { TiposClienteTable } from "@/components/tipos-cliente/TiposClienteTable";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Tipos de cliente | Palacio · ERP",
};

/**
 * @param {{ searchParams: Promise<{ inactivos?: string }> }} props
 */
export default async function TiposDeClientePage({ searchParams }) {
  const sp = await searchParams;
  const incluirInactivos = sp?.inactivos === "1";

  const { data, error } = await listarTiposCliente(incluirInactivos);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[{ label: "Ventas" }, { label: "Tipos de cliente" }]}
        title="Tipos de cliente"
        description="Alta, edición y administración de tipos de cliente y su lista de precios."
      />

      {error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudieron cargar los tipos de cliente</p>
          <p className="mt-1 text-amber-900/80">{error}</p>
        </div>
      ) : (
        <TiposClienteTable
          tipos={data ?? []}
          incluirInactivos={incluirInactivos}
        />
      )}
    </div>
  );
}
