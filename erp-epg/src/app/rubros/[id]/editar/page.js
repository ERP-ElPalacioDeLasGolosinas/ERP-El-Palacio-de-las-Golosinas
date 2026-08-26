import Link from "next/link";
import { notFound } from "next/navigation";
import { RubroForm } from "@/components/rubros/RubroForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { obtenerRubro } from "@/lib/rubros/actions";

export const metadata = {
  title: "Editar rubro | Palacio · ERP",
};

/**
 * @param {{ params: Promise<{ id: string }> }} props
 */
export default async function EditarRubroPage({ params }) {
  const { id } = await params;
  const { data, error } = await obtenerRubro(id);

  if (error) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
        <div className="card border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          Error al cargar: {error}
        </div>
        <Link
          href="/rubros"
          className="mt-4 inline-block text-sm font-medium text-primary underline"
        >
          Volver a rubros
        </Link>
      </div>
    );
  }

  if (!data) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[
          { label: "Inicio", href: "/" },
          { label: "Rubros", href: "/rubros" },
          { label: "Editar" },
        ]}
        title="Editar rubro"
        hu="A-03"
        description={data.nombre_rubro}
      />
      <RubroForm rubro={data} />
    </div>
  );
}
