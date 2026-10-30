import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { ResultadoChart, mesLabel, moneda } from "@/components/dashboard/ResultadoChart";
import { DesplazamientoHorizontal } from "@/components/ui/DesplazamientoHorizontal";
import {
  listarProductosMasVendidos,
  listarResultadoMensual,
  listarVentasPorDeposito,
} from "@/lib/dashboard/actions";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function hoyAR() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date());
}

export default async function Home({ searchParams }) {
  const params = await searchParams;
  const hoy = hoyAR();
  const desdeDefault = `${hoy.slice(0, 4)}-01-01`;
  const desde = ISO.test(params?.desde) ? params.desde : desdeDefault;
  const hasta = ISO.test(params?.hasta) ? params.hasta : hoy;
  const rangoValido = desde <= hasta;

  const [mensual, depositos, productos] = rangoValido
    ? await Promise.all([
        listarResultadoMensual(desde, hasta),
        listarVentasPorDeposito(desde, hasta),
        listarProductosMasVendidos(desde, hasta),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ];

  const meses = mensual.data ?? [];
  const vendido = meses.reduce((s, m) => s + Number(m.ingresos), 0);
  const gastado = meses.reduce((s, m) => s + Number(m.egresos), 0);
  const ganado = vendido - gastado;
  const error = mensual.error || depositos.error || productos.error;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[{ label: "Dashboard" }, { label: "Resultado" }]}
        title="Resultado"
        description="Cuánto se vendió, cuánto se gastó y cuánto quedó, mes a mes."
      />

      <form method="get" className="palacio-card mb-6 flex flex-wrap items-end gap-3 p-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-700">Desde</span>
          <input className="palacio-input" type="date" name="desde" defaultValue={desde} required />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-700">Hasta</span>
          <input className="palacio-input" type="date" name="hasta" defaultValue={hasta} required />
        </label>
        <button type="submit" className="palacio-btn-primary inline-flex px-4 py-2.5 text-sm">
          Filtrar
        </button>
        <Link href="/" className="palacio-btn-secondary inline-flex items-center px-4 py-2.5 text-sm">
          Limpiar
        </Link>
      </form>

      {!rangoValido ? (
        <p className="mb-6 text-sm text-red-700">La fecha desde tiene que ser anterior o igual a la fecha hasta.</p>
      ) : null}
      {error ? <p className="mb-6 text-sm text-red-700">{error}</p> : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <article className="palacio-card p-5">
          <p className="text-sm text-palacio-muted">Ingresos</p>
          <p className="mt-1 text-2xl font-semibold text-green-800">{moneda(vendido)}</p>
        </article>
        <article className="palacio-card p-5">
          <p className="text-sm text-palacio-muted">Egresos</p>
          <p className="mt-1 text-2xl font-semibold text-red-800">{moneda(gastado)}</p>
        </article>
        <article className="palacio-card p-5">
          <p className="text-sm text-palacio-muted">Balance</p>
          <p className={`mt-1 text-2xl font-semibold ${ganado > 0 ? "text-green-800" : ganado < 0 ? "text-red-800" : "text-zinc-900"}`}>
            {moneda(ganado)}
          </p>
        </article>
      </div>

      <section className="palacio-card mb-6 p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Ingresos y egresos por mes</h2>
            <p className="mt-1 text-sm text-palacio-muted">
              Los ingresos son las ventas. Los egresos son las facturas y notas de débito de compra, menos las notas de crédito.
            </p>
          </div>
          <div className="flex gap-4 text-xs text-zinc-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-green-700" /> Ingresos
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-700" /> Egresos
            </span>
          </div>
        </div>
        {meses.length === 0 ? (
          <p className="text-sm text-palacio-muted">No hay meses para mostrar en este rango.</p>
        ) : (
          <>
            <ResultadoChart meses={meses} />
            <DesplazamientoHorizontal className="mt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-palacio-muted">
                    <th className="py-2 font-medium">Mes</th>
                    <th className="py-2 text-right font-medium">Ingresos</th>
                    <th className="py-2 text-right font-medium">Egresos</th>
                    <th className="py-2 text-right font-medium">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {meses.map((m) => (
                    <tr key={m.mes} className="border-b border-zinc-100">
                      <td className="py-2">{mesLabel(m.mes)}</td>
                      <td className="py-2 text-right">{moneda(m.ingresos)}</td>
                      <td className="py-2 text-right">{moneda(m.egresos)}</td>
                      <td className={`py-2 text-right ${Number(m.resultado) >= 0 ? "text-green-800" : "text-red-800"}`}>
                        {moneda(m.resultado)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DesplazamientoHorizontal>
          </>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="palacio-card p-5">
          <h2 className="text-sm font-semibold text-zinc-900">Ventas por depósito</h2>
          <p className="mt-1 mb-3 text-sm text-palacio-muted">Detalle de los ingresos, sin reemplazar el total del período.</p>
          {(depositos.data ?? []).length === 0 ? (
            <p className="text-sm text-palacio-muted">No hubo ventas en este rango.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {depositos.data.map((d) => (
                  <tr key={d.id_deposito} className="border-b border-zinc-100">
                    <td className="py-2">{d.nombre_deposito}</td>
                    <td className="py-2 text-right">{moneda(d.ingresos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="palacio-card p-5">
          <h2 className="text-sm font-semibold text-zinc-900">Productos que más se vendieron</h2>
          <p className="mt-1 mb-3 text-sm text-palacio-muted">Los cinco de mayor importe en el mismo rango.</p>
          {(productos.data ?? []).length === 0 ? (
            <p className="text-sm text-palacio-muted">No hubo ventas en este rango.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {productos.data.map((p) => (
                  <tr key={p.id_producto} className="border-b border-zinc-100">
                    <td className="py-2">
                      {p.nombre_producto}
                      <span className="ml-2 text-palacio-muted">{Number(p.cantidad)} u.</span>
                    </td>
                    <td className="py-2 text-right">{moneda(p.ingresos)}</td>
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
