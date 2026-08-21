import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[{ label: "Inicio" }]}
        title="Inicio"
        description="Seleccioná un módulo del menú para continuar."
      />

      <div className="palacio-card space-y-3 p-5">
        <h2 className="text-sm font-semibold tracking-wide text-palacio-muted uppercase">
          Sprint 1 — disponible
        </h2>
        <Link
          href="/rubros"
          className="flex items-center justify-between rounded-lg border border-palacio-border px-4 py-3 transition hover:border-palacio-red/30 hover:bg-palacio-red-soft/40"
        >
          <div>
            <p className="font-semibold text-zinc-900">Gestionar rubros</p>
            <p className="text-sm text-palacio-muted">
              Alta, edición, inhabilitación y baja de rubros del catálogo
            </p>
          </div>
          <span className="palacio-badge-hu">A-03</span>
        </Link>
      </div>
    </div>
  );
}
