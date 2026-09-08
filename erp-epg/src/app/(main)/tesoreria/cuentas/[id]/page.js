import { notFound } from "next/navigation";
import {
  listarCuentasTesoreria,
  listarMovimientosCuenta,
} from "@/lib/cuentas-tesoreria/actions";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Movimientos de la cuenta | Palacio · ERP",
};

const fechaFmt = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const montoFmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

function formatFecha(valor) {
  if (!valor) return "—";
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? "—" : fechaFmt.format(d);
}

function formatMonto(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? montoFmt.format(n) : "—";
}

/**
 * @param {{ params: Promise<{ id: string }> }} props
 */
export default async function MovimientosCuentaPage({ params }) {
  const { id } = await params;

  const [cuentasRes, movimientosRes] = await Promise.all([
    listarCuentasTesoreria(true, null),
    listarMovimientosCuenta(id),
  ]);

  const cuenta = (cuentasRes.data ?? []).find((c) => c.id_cuenta === id);

  if (!cuenta) {
    if (cuentasRes.error) {
      return (
        <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8">
          <PageHeader
            crumbs={[
              { label: "Tesorería" },
              { label: "Cuentas", href: "/tesoreria/cuentas" },
              { label: "Movimientos" },
            ]}
            title="Movimientos de la cuenta"
          />
          <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
            <p className="font-medium">No se pudo cargar la cuenta</p>
            <p className="mt-1 text-amber-900/80">{cuentasRes.error}</p>
          </div>
        </div>
      );
    }
    notFound();
  }

  const movimientos = movimientosRes.data ?? [];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[
          { label: "Tesorería" },
          { label: "Cuentas", href: "/tesoreria/cuentas" },
          { label: cuenta.nombre_cuenta },
        ]}
        title={cuenta.nombre_cuenta}
        description={`${cuenta.tipo} · Saldo actual ${formatMonto(cuenta.saldo_actual)}`}
      />

      <dl className="palacio-card mb-6 grid grid-cols-2 gap-x-6 gap-y-3 px-5 py-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-palacio-muted uppercase">Tipo</dt>
          <dd className="mt-0.5 text-zinc-900">{cuenta.tipo}</dd>
        </div>
        <div>
          <dt className="text-xs text-palacio-muted uppercase">Saldo inicial</dt>
          <dd className="mt-0.5 tabular-nums text-zinc-900">
            {formatMonto(cuenta.saldo_inicial)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-palacio-muted uppercase">Saldo actual</dt>
          <dd className="mt-0.5 tabular-nums text-zinc-900">
            {formatMonto(cuenta.saldo_actual)}
          </dd>
        </div>
      </dl>

      {movimientosRes.error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudieron cargar los movimientos</p>
          <p className="mt-1 text-amber-900/80">{movimientosRes.error}</p>
        </div>
      ) : movimientos.length === 0 ? (
        <div className="palacio-card px-6 py-12 text-center">
          <p className="text-sm text-palacio-muted">
            Sin movimientos. El historial se completa a medida que se registran
            pagos de tesorería.
          </p>
        </div>
      ) : (
        <div className="palacio-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-palacio-border bg-zinc-50/80">
                  <Th>Fecha</Th>
                  <Th>Tipo</Th>
                  <Th className="text-right">Importe</Th>
                  <Th className="text-right">Saldo anterior</Th>
                  <Th className="text-right">Saldo nuevo</Th>
                  <Th>Referencia</Th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((m) => (
                  <tr
                    key={m.id_movimiento}
                    className="border-b border-palacio-border last:border-0"
                  >
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {formatFecha(m.fecha)}
                    </td>
                    <td className="px-5 py-4 align-middle text-zinc-900">
                      {m.tipo}
                    </td>
                    <td className="px-5 py-4 text-right align-middle tabular-nums text-zinc-900">
                      {formatMonto(m.importe)}
                    </td>
                    <td className="px-5 py-4 text-right align-middle tabular-nums text-palacio-muted">
                      {formatMonto(m.saldo_anterior)}
                    </td>
                    <td className="px-5 py-4 text-right align-middle tabular-nums text-palacio-muted">
                      {formatMonto(m.saldo_nuevo)}
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {m.referencia || m.descripcion || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Th({ children, className = "" }) {
  return (
    <th
      className={`px-5 py-3 text-[11px] font-semibold tracking-wider text-palacio-muted uppercase ${className}`}
    >
      {children}
    </th>
  );
}
