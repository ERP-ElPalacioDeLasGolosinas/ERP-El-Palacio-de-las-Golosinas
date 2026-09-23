import Link from "next/link";
import { badgeEstadoVenta } from "@/lib/ventas/estado";

const fechaFmt = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const monedaFmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

function formatFecha(valor) {
  if (!valor) return "—";
  const d = new Date(String(valor).length <= 10 ? `${valor}T00:00:00` : valor);
  return Number.isNaN(d.getTime()) ? "—" : fechaFmt.format(d);
}

/**
 * Detalle read-only de un cobro: venta cobrada, medios con su cuenta y
 * movimientos de tesorería generados.
 *
 * @param {{
 *   cobro: Record<string, any>,
 *   medios: Array<Record<string, any>>,
 *   movimientos: Array<Record<string, any>>,
 * }} props
 */
export function CobroDetalle({ cobro, medios, movimientos }) {
  return (
    <>
      <div className="palacio-card p-5 md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-900">Datos del cobro</h2>
          <Link
            href={`/ventas/ordenes/${cobro.id_comprobante}`}
            className="palacio-action-btn palacio-action-primary"
          >
            Ver venta
          </Link>
        </div>
        <dl className="grid gap-4 text-sm md:grid-cols-2">
          <Dato label="Cliente" valor={cobro.nombre_cliente} />
          <Dato
            label="Venta"
            valor={`${cobro.nombre_tipo_comprobante ?? ""} ${cobro.numero_formateado ?? ""}`.trim()}
          />
          <Dato label="Importe" valor={monedaFmt.format(Number(cobro.importe_total) || 0)} />
          <Dato label="Fecha del cobro" valor={formatFecha(cobro.fecha_cobro)} />
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs font-medium tracking-wide text-palacio-muted uppercase">Estado de la venta</dt>
            <dd>
              <span className={badgeEstadoVenta(cobro.estado_venta)}>{cobro.estado_venta}</span>
            </dd>
          </div>
          <Dato label="Registrado por" valor={cobro.creado_por_nombre} />
          {cobro.observaciones ? <Dato label="Observaciones" valor={cobro.observaciones} full /> : null}
        </dl>
      </div>

      <div className="palacio-card mt-6 overflow-hidden">
        <div className="border-b border-palacio-border px-5 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">Medios de pago</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-palacio-border bg-zinc-50/80">
                <Th>Medio</Th>
                <Th>Cuenta</Th>
                <Th>Referencia</Th>
                <Th className="text-right">Importe</Th>
              </tr>
            </thead>
            <tbody>
              {medios.map((m) => (
                <tr key={m.id} className="border-b border-palacio-border last:border-0">
                  <td className="px-5 py-3 align-middle text-zinc-900">{m.nombre_medio_pago}</td>
                  <td className="px-5 py-3 align-middle text-palacio-muted">
                    {m.nombre_cuenta} ({m.tipo_cuenta})
                  </td>
                  <td className="px-5 py-3 align-middle text-palacio-muted">{m.referencia || "—"}</td>
                  <td className="px-5 py-3 text-right align-middle font-medium text-zinc-900">
                    {monedaFmt.format(Number(m.importe) || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="palacio-card mt-6 overflow-hidden">
        <div className="border-b border-palacio-border px-5 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">Movimientos de tesorería generados</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-palacio-border bg-zinc-50/80">
                <Th>Cuenta</Th>
                <Th className="text-center">Tipo</Th>
                <Th className="text-right">Importe</Th>
                <Th className="text-right">Saldo anterior</Th>
                <Th className="text-right">Saldo nuevo</Th>
              </tr>
            </thead>
            <tbody>
              {movimientos.map((m) => (
                <tr key={m.id_movimiento} className="border-b border-palacio-border last:border-0">
                  <td className="px-5 py-3 align-middle text-zinc-900">{m.nombre_cuenta}</td>
                  <td className="px-5 py-3 text-center align-middle text-palacio-muted">{m.tipo}</td>
                  <td className="px-5 py-3 text-right align-middle font-medium text-zinc-900">
                    {monedaFmt.format(Number(m.importe) || 0)}
                  </td>
                  <td className="px-5 py-3 text-right align-middle text-palacio-muted">
                    {monedaFmt.format(Number(m.saldo_anterior) || 0)}
                  </td>
                  <td className="px-5 py-3 text-right align-middle text-palacio-muted">
                    {monedaFmt.format(Number(m.saldo_nuevo) || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/tesoreria/cobranzas" className="palacio-btn-secondary px-4 py-2.5 text-sm">
          Volver al listado
        </Link>
      </div>
    </>
  );
}

function Dato({ label, valor, full = false }) {
  return (
    <div className={`flex flex-col gap-0.5 ${full ? "md:col-span-2" : ""}`}>
      <dt className="text-xs font-medium tracking-wide text-palacio-muted uppercase">{label}</dt>
      <dd className="text-zinc-900">{valor || "—"}</dd>
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
