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
        crumbs={[
          { label: "Inicio", href: "/" },
          { label: "Artículos y catálogo", href: "/rubros" },
          { label: "Rubros" },
        ]}
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
          <p className="mt-2 text-amber-900/70">
            Si el mensaje menciona RLS o permisos,{" "}
            <Link href="/login" className="font-medium underline">
              iniciá sesión
            </Link>{" "}
            con un usuario de Supabase Auth (políticas: rol{" "}
            <code className="rounded bg-amber-100 px-1">authenticated</code>
            ). Si habla de relación inexistente, aplicá la migración{" "}
            <code className="rounded bg-amber-100 px-1">
              20260821130000_a03_rubro.sql
            </code>
            .
          </p>
        </div>
      ) : (
        <RubrosTable rubros={data ?? []} />
      )}
    </div>
  );
}
