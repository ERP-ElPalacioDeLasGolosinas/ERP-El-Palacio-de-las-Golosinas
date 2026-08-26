import Link from "next/link";
import { getUserWithRole } from "@/lib/auth/roles";
import { PageHeader } from "@/components/layout/PageHeader";

export default async function Home() {
  const usuario = await getUserWithRole();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        title="Inicio"
        description={
          usuario
            ? `Hola, ${usuario.nombre} ${usuario.apellido}. Elegí un módulo para continuar.`
            : "Elegí un módulo para continuar."
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/deposito"
          className="palacio-card flex flex-col gap-1 p-5 transition hover:border-palacio-red/30 hover:shadow-md"
        >
          <span className="text-sm font-semibold text-zinc-900">Depósitos</span>
          <span className="text-sm text-palacio-muted">
            Alta, edición y administración operativa de depósitos.
          </span>
        </Link>
        <Link
          href="/rubros"
          className="palacio-card flex flex-col gap-1 p-5 transition hover:border-palacio-red/30 hover:shadow-md"
        >
          <span className="text-sm font-semibold text-zinc-900">Rubros</span>
          <span className="text-sm text-palacio-muted">
            Primer nivel del catálogo: alta, edición e inhabilitación.
          </span>
        </Link>
        <Link
          href="/categorias"
          className="palacio-card flex flex-col gap-1 p-5 transition hover:border-palacio-red/30 hover:shadow-md"
        >
          <span className="text-sm font-semibold text-zinc-900">Categorías</span>
          <span className="text-sm text-palacio-muted">
            Subclasificación bajo un rubro (segundo nivel del catálogo).
          </span>
        </Link>
      </div>
    </div>
  );
}
