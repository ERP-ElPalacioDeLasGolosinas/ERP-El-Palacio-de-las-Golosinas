import Link from "next/link";
import { notFound } from "next/navigation";
import { DepositoForm } from "@/components/depositos/DepositoForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { obtenerDeposito } from "@/lib/depositos/actions";

export const metadata = {
  title: "Editar depósito | Palacio · ERP",
};

/**
 * @param {{ params: Promise<{ id: string }> }} props
 */
export default async function EditarDepositoPage({ params }) {
  const { id } = await params;
  const { data, error } = await obtenerDeposito(id);

  if (error) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
        <div className="palacio-card border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          Error al cargar: {error}
        </div>
        <Link
          href="/depositos"
          className="mt-4 inline-block text-sm font-medium text-palacio-red underline"
        >
          Volver a depósitos
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
          { label: "Depósitos", href: "/depositos" },
          { label: "Editar" },
        ]}
        title="Editar depósito"
        hu="S-01"
        description={data.nombre_deposito}
      />
      <DepositoForm deposito={data} />
    </div>
  );
}
