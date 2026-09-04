import { listarTiposComprobante } from "@/lib/tipos-comprobante/actions";
import { TiposComprobanteTable } from "@/components/tipos-comprobante/TiposComprobanteTable";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Tipos de comprobante | Palacio · ERP",
};

/**
 * @param {{ searchParams: Promise<{ inactivos?: string }> }} props
 */
export default async function TiposDeComprobantePage({ searchParams }) {
  const sp = await searchParams;
  const incluirInactivos = sp?.inactivos === "1";

  const { data, error } = await listarTiposComprobante(incluirInactivos);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[{ label: "Tesorería" }, { label: "Tipos de comprobante" }]}
        title="Tipos de comprobante"
        description="Alta, edición y administración de tipos de comprobante de proveedor."
      />

      {error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">
            No se pudieron cargar los tipos de comprobante
          </p>
          <p className="mt-1 text-amber-900/80">{error}</p>
        </div>
      ) : (
        <TiposComprobanteTable
          tipos={data ?? []}
          incluirInactivos={incluirInactivos}
        />
      )}
    </div>
  );
}
