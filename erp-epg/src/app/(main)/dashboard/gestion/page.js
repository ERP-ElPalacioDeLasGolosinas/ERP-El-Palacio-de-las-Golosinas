import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { moneda } from "@/components/dashboard/ResultadoChart";
import { listarCajas } from "@/lib/cajas/actions";
import { listarCuentasClientes, listarCuentasProveedores } from "@/lib/cuentas-corrientes/actions";
import { listarAlertasStock } from "@/lib/stock/actions";

const fechaHora = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Argentina/Buenos_Aires",
});

function cuando(valor) {
  if (!valor) return "—";
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? "—" : fechaHora.format(fecha);
}

export default async function GestionPage() {
  const [clientes, proveedores, alertas, cajas] = await Promise.all([
    listarCuentasClientes(),
    listarCuentasProveedores(),
    listarAlertasStock(null),
    listarCajas({ estado: "Abierta" }),
  ]);

  const nosDeben = (clientes.data ?? [])
    .filter((c) => Number(c.saldo) > 0)
    .sort((a, b) => Number(b.saldo) - Number(a.saldo));
  const debemos = (proveedores.data ?? [])
    .filter((p) => Number(p.saldo) > 0)
    .sort((a, b) => Number(b.saldo) - Number(a.saldo));
  const criticos = [...(alertas.data ?? [])].sort(
    (a, b) => Number(a.diferencia) - Number(b.diferencia),
  );
  const abiertas = cajas.data ?? [];
  const error = clientes.error || proveedores.error || alertas.error || cajas.error;
  const totalNosDeben = nosDeben.reduce((s, c) => s + Number(c.saldo), 0);
  const totalDebemos = debemos.reduce((s, p) => s + Number(p.saldo), 0);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[{ label: "Dashboard" }, { label: "Gestión" }]}
        title="Gestión"
        description="Lo que hay que cobrar, lo que hay que pagar, el stock que está bajo y las cajas que siguen abiertas."
      />

      {error ? <p className="mb-6 text-sm text-red-700">{error}</p> : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="palacio-card p-5">
          <p className="text-sm text-palacio-muted">Nos deben</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">{moneda(totalNosDeben)}</p>
          <p className="mt-1 text-xs text-palacio-muted">{nosDeben.length} clientes</p>
        </article>
        <article className="palacio-card p-5">
          <p className="text-sm text-palacio-muted">Debemos</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">{moneda(totalDebemos)}</p>
          <p className="mt-1 text-xs text-palacio-muted">{debemos.length} proveedores</p>
        </article>
        <article className="palacio-card p-5">
          <p className="text-sm text-palacio-muted">Bajo mínimo</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">{criticos.length}</p>
          <p className="mt-1 text-xs text-palacio-muted">artículos en alerta</p>
        </article>
        <article className="palacio-card p-5">
          <p className="text-sm text-palacio-muted">Cajas abiertas</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">{abiertas.length}</p>
          <p className="mt-1 text-xs text-palacio-muted">sin cerrar ahora</p>
        </article>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="palacio-card p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Clientes que más deben</h2>
              <p className="mt-1 text-sm text-palacio-muted">Saldo actual de la cuenta corriente.</p>
            </div>
            <Link href="/tesoreria/cuentas-corrientes/clientes" className="palacio-btn-secondary inline-flex items-center px-4 py-2.5 text-sm">
              Ver cuentas
            </Link>
          </div>
          {nosDeben.length === 0 ? (
            <p className="text-sm text-palacio-muted">Ningún cliente tiene saldo a cobrar.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {nosDeben.slice(0, 5).map((c) => (
                  <tr key={c.id_cliente} className="border-b border-zinc-100">
                    <td className="py-2">{c.nombre_cliente}</td>
                    <td className="py-2 text-right">{moneda(c.saldo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="palacio-card p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Proveedores a los que más les debemos</h2>
              <p className="mt-1 text-sm text-palacio-muted">Saldo en contra de la cuenta corriente.</p>
            </div>
            <Link href="/tesoreria/cuentas-corrientes/proveedores" className="palacio-btn-secondary inline-flex shrink-0 items-center px-4 py-2.5 text-sm">
              Ver cuentas
            </Link>
          </div>
          {debemos.length === 0 ? (
            <p className="text-sm text-palacio-muted">No hay saldos en contra con proveedores.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {debemos.slice(0, 5).map((p) => (
                  <tr key={p.id_proveedor} className="border-b border-zinc-100">
                    <td className="py-2">{p.nombre_proveedor}</td>
                    <td className="py-2 text-right">{moneda(p.saldo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="palacio-card p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Stock más justo</h2>
              <p className="mt-1 text-sm text-palacio-muted">Los que más se pasan por debajo del mínimo.</p>
            </div>
            <Link href="/inventario/stock/alertas" className="palacio-btn-secondary inline-flex shrink-0 items-center px-4 py-2.5 text-sm">
              Ver alertas
            </Link>
          </div>
          {criticos.length === 0 ? (
            <p className="text-sm text-palacio-muted">No hay artículos bajo el mínimo.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {criticos.slice(0, 6).map((a) => (
                  <tr key={`${a.id_producto}-${a.id_deposito}`} className="border-b border-zinc-100">
                    <td className="py-2">
                      {a.nombre_completo}
                      <span className="mt-0.5 block text-xs text-palacio-muted">{a.nombre_deposito}</span>
                    </td>
                    <td className="py-2 text-right">
                      {Number(a.stock_actual)}
                      <span className="mt-0.5 block text-xs text-palacio-muted">mín. {Number(a.stock_minimo)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="palacio-card p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Cajas abiertas</h2>
              <p className="mt-1 text-sm text-palacio-muted">Quién las está atendiendo ahora.</p>
            </div>
            <Link href="/ventas/cajas" className="palacio-btn-secondary inline-flex shrink-0 items-center px-4 py-2.5 text-sm">
              Ver cajas
            </Link>
          </div>
          {abiertas.length === 0 ? (
            <p className="text-sm text-palacio-muted">No hay cajas abiertas.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {abiertas.map((c) => (
                  <tr key={c.id_caja} className="border-b border-zinc-100">
                    <td className="py-2">
                      Caja {c.punto_venta}
                      <span className="mt-0.5 block text-xs text-palacio-muted">
                        {c.nombre_deposito} · {c.abierta_por_nombre}
                      </span>
                    </td>
                    <td className="py-2 text-right text-palacio-muted">{cuando(c.fecha_apertura)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
