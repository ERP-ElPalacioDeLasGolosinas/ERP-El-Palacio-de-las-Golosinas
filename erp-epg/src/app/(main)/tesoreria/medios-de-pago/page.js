import { listarMediosPago } from "@/lib/medios-pago/actions";
import { MediosPagoTable } from "@/components/medios-pago/MediosPagoTable";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Medios de pago | Palacio · ERP",
};

/**
 * @param {{ searchParams: Promise<{ inactivos?: string }> }} props
 */
export default async function MediosDePagoPage({ searchParams }) {
  const sp = await searchParams;
  const incluirInactivos = sp?.inactivos === "1";

  const { data, error } = await listarMediosPago(incluirInactivos);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[{ label: "Tesorería" }, { label: "Medios de pago" }]}
        title="Medios de pago"
        description="Alta, edición y administración de medios de pago (catálogo compartido)."
      />

      {error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudieron cargar los medios de pago</p>
          <p className="mt-1 text-amber-900/80">{error}</p>
        </div>
      ) : (
        <MediosPagoTable
          mediosPago={data ?? []}
          incluirInactivos={incluirInactivos}
        />
      )}
    </div>
  );
}
