import Link from "next/link";
import { listarCajas } from "@/lib/cajas/actions";
import { listarDepositos } from "@/lib/depositos/actions";
import { AbrirCajaForm } from "@/components/cajas/AbrirCajaForm";
import { fechaHora, moneda } from "@/components/cajas/formato";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Cajas | Palacio · ERP",
};

export default async function CajasAbiertasPage() {
  const [{ data, error }, depositosRes] = await Promise.all([
    listarCajas({ estado: "Abierta" }),
    listarDepositos(false),
  ]);

  const depositos = (depositosRes.data ?? [])
    .filter((d) => d.activo)
    .map((d) => ({ id_deposito: d.id_deposito, nombre_deposito: d.nombre_deposito }));

  const abiertas = data ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[{ label: "Ventas" }, { label: "Cajas" }, { label: "Abiertas" }]}
        title="Cajas abiertas"
        description="Una sucursal puede tener varias cajas abiertas. Cada una vende el stock del depósito en el que se abrió."
        actions={
          <Link href="/ventas/cajas/historial" className="palacio-btn-secondary inline-flex px-4 py-2.5 text-sm">
            Historial
          </Link>
        }
      />

      {error || depositosRes.error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudieron cargar las cajas</p>
          <p className="mt-1 text-amber-900/80">{error || depositosRes.error}</p>
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
          <div>
            {abiertas.length === 0 ? (
              <div className="palacio-card px-6 py-12 text-center">
                <p className="text-sm text-palacio-muted">No hay cajas abiertas. Abrí una para cobrar en el local.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {abiertas.map((c) => (
                  <li key={c.id_caja}>
                    <Link
                      href={`/ventas/cajas/${c.id_caja}`}
                      className="palacio-card flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition hover:border-zinc-400"
                    >
                      <div>
                        <p className="font-semibold text-zinc-900">{c.nombre_deposito || "Sin depósito"}</p>
                        <p className="mt-0.5 text-sm text-palacio-muted">
                          Abierta {fechaHora(c.fecha_apertura)} · {c.abierta_por_nombre}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-palacio-muted">Monto inicial</p>
                        <p className="font-semibold text-zinc-900">{moneda(c.monto_inicial)}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <AbrirCajaForm depositos={depositos} />
        </div>
      )}
    </div>
  );
}
