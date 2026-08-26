import Link from "next/link";
import { listarRubros } from "@/lib/rubros/actions";
import { RubrosTable } from "@/components/rubros/RubrosTable";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Rubros | Palacio · ERP",
};

export default async function RubrosPage() {
  const { data, error } = await listarRubros();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[{ label: "Rubros" }]}
        title="Gestionar rubros"
        description="Alta, edición, inhabilitación y baja de rubros del catálogo (primer nivel de clasificación)."
        actions={
          <Link
            href="/rubros/nuevo"
            className="palacio-btn-primary inline-flex px-4 py-2.5 text-sm"
          >
            Nuevo rubro
          </Link>
        }
      />

      {error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudieron cargar los rubros</p>
          <p className="mt-1 text-amber-900/80">{error}</p>
        </div>
      ) : (
        <RubrosTable rubros={data ?? []} />
      )}
    </div>
  );
}
