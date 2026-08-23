import Link from "next/link";
import { listarDepositos } from "@/lib/depositos/actions";
import { DepositosTable } from "@/components/depositos/DepositosTable";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Depósitos | Palacio · ERP",
};

export default async function DepositosPage() {
  const { data, error } = await listarDepositos();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[
          { label: "Depósitos" },
        ]}
        title="Gestionar depósitos"
        description="Alta, edición y administración operativa de depósitos."
        actions={
          <Link
            href="/depositos/nuevo"
            className="palacio-btn-primary inline-flex px-4 py-2.5 text-sm"
          >
            Nuevo depósito
          </Link>
        }
      />

      {error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudieron cargar los depósitos</p>
          <p className="mt-1 text-amber-900/80">{error}</p>
        </div>
      ) : (
        <DepositosTable depositos={data ?? []} />
      )}
    </div>
  );
}
