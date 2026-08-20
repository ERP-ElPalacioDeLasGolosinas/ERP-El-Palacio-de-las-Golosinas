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
          { label: "Inicio", href: "/" },
          { label: "Depósitos" },
        ]}
        title="Gestionar depósitos"
        hu="S-01"
        description="Alta, edición y activación de depósitos del sistema."
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
          <p className="mt-2 text-amber-900/70">
            Si el mensaje menciona RLS o permisos, iniciá sesión con un usuario
            autenticado de Supabase (políticas actuales: rol{" "}
            <code className="rounded bg-amber-100 px-1">authenticated</code>).
          </p>
        </div>
      ) : (
        <DepositosTable depositos={data ?? []} />
      )}
    </div>
  );
}
