"use client";

import Link from "next/link";
import { badgeEstadoComprobante } from "@/lib/comprobantes/estado";

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
 * T-08 · Detalle read-only de un pago: cabecera, comprobantes cancelados,
 * medios usados y movimientos de tesorería generados. El pago es inmutable
 * (no hay acciones).
 *
 * @param {{
 *   pago: Record<string, any>,
 *   medios: Array<Record<string, any>>,
 *   aplicaciones: Array<Record<string, any>>,
 *   movimientos: Array<Record<string, any>>,
 * }} props
 */
export function PagoDetalle({ pago, medios, aplicaciones, movimientos }) {
  const totalAplicado = aplicaciones.reduce(
    (acc, a) => acc + (Number(a.importe_aplicado) || 0),
    0
  );
  const totalMedios = medios.reduce(
    (acc, m) => acc + (Number(m.importe) || 0),
    0
  );
  const cheques = medios
    .filter((m) => m.cheque)
    .map((m) => ({ ...m.cheque, nombre_medio_pago: m.nombre_medio_pago }));

  return (
    <>
      <div className="palacio-card p-5 md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-900">Datos del pago</h2>
          {pago.id_orden_pago ? (
            <Link
              href={`/tesoreria/ordenes-de-pago/${pago.id_orden_pago}`}
              className="palacio-action-btn palacio-action-primary"
            >
              Ver orden de pago
            </Link>
          ) : null}
        </div>

        <dl className="grid gap-4 text-sm md:grid-cols-2">
          <Dato label="Proveedor" valor={pago.nombre_proveedor} />
          <Dato
            label="Importe total"
            valor={monedaFmt.format(Number(pago.importe_total) || 0)}
          />
          <Dato label="Fecha del pago" valor={formatFecha(pago.fecha_pago)} />
          <Dato label="Estado de la orden" valor={pago.estado_orden} />
          <Dato label="Registrado" valor={formatFecha(pago.creado)} />
          <Dato label="Registrado por" valor={pago.creado_por_nombre} />
          {pago.observaciones ? (
            <Dato label="Observaciones" valor={pago.observaciones} full />
          ) : null}
        </dl>
      </div>

      {/* Comprobantes cancelados */}
      <div className="palacio-card mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">
            Comprobantes cancelados
          </h2>
          <span className="text-xs text-palacio-muted">
            {aplicaciones.length} comprobante
            {aplicaciones.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-palacio-border bg-zinc-50/80">
                <Th>Comprobante</Th>
                <Th>Vencimiento</Th>
                <Th className="text-center">Estado</Th>
                <Th className="text-right">Saldo actual</Th>
                <Th className="text-right">Aplicado</Th>
              </tr>
            </thead>
            <tbody>
              {aplicaciones.map((a) => (
                <tr
                  key={a.id}
                  className="border-b border-palacio-border last:border-0"
                >
                  <td className="px-5 py-3 align-middle">
                    <span className="font-mono text-xs text-zinc-700">
                      {a.numero_formateado}
                    </span>
                    <span className="ml-2 text-palacio-muted">
                      {a.nombre_tipo_comprobante}
                      {a.letra ? ` (${a.letra})` : ""}
                    </span>
                  </td>
                  <td className="px-5 py-3 align-middle text-palacio-muted">
                    {formatFecha(a.fecha_vencimiento)}
                  </td>
                  <td className="px-5 py-3 text-center align-middle">
                    <span className={badgeEstadoComprobante(a.estado)}>
                      {a.estado}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right align-middle text-palacio-muted">
                    {monedaFmt.format(Number(a.saldo_pendiente) || 0)}
                  </td>
                  <td className="px-5 py-3 text-right align-middle font-medium text-zinc-900">
                    {monedaFmt.format(Number(a.importe_aplicado) || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-palacio-border bg-zinc-50/60">
                <td
                  className="px-5 py-3 text-right font-medium text-palacio-muted"
                  colSpan={4}
                >
                  Total aplicado
                </td>
                <td className="px-5 py-3 text-right font-semibold text-zinc-900">
                  {monedaFmt.format(totalAplicado)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Medios usados */}
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
                <tr
                  key={m.id}
                  className="border-b border-palacio-border last:border-0"
                >
                  <td className="px-5 py-3 align-middle text-zinc-900">
                    {m.nombre_medio_pago}
                    <span className="ml-2 text-xs text-palacio-muted">
                      {m.tipo_medio_pago}
                    </span>
                  </td>
                  <td className="px-5 py-3 align-middle text-palacio-muted">
                    {m.nombre_cuenta} ({m.tipo_cuenta})
                  </td>
                  <td className="px-5 py-3 align-middle text-palacio-muted">
                    {m.referencia || "—"}
                  </td>
                  <td className="px-5 py-3 text-right align-middle font-medium text-zinc-900">
                    {monedaFmt.format(Number(m.importe) || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-palacio-border bg-zinc-50/60">
                <td
                  className="px-5 py-3 text-right font-medium text-palacio-muted"
                  colSpan={3}
                >
                  Total medios
                </td>
                <td className="px-5 py-3 text-right font-semibold text-zinc-900">
                  {monedaFmt.format(totalMedios)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Cheques */}
      {cheques.length > 0 ? (
        <div className="palacio-card mt-6 overflow-hidden">
          <div className="border-b border-palacio-border px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Cheques</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-palacio-border bg-zinc-50/80">
                  <Th>Número</Th>
                  <Th>Banco</Th>
                  <Th>Cuenta</Th>
                  <Th>Emisión</Th>
                  <Th>Cobro / pago</Th>
                  <Th className="text-right">Importe</Th>
                </tr>
              </thead>
              <tbody>
                {cheques.map((ch, i) => (
                  <tr
                    key={`${ch.numero}-${i}`}
                    className="border-b border-palacio-border last:border-0"
                  >
                    <td className="px-5 py-3 align-middle font-mono text-xs text-zinc-700">
                      {ch.numero}
                    </td>
                    <td className="px-5 py-3 align-middle text-zinc-900">
                      {ch.banco}
                      <span className="ml-2 text-xs text-palacio-muted">
                        {ch.nombre_medio_pago}
                      </span>
                    </td>
                    <td className="px-5 py-3 align-middle text-palacio-muted">
                      {ch.cuenta || "—"}
                    </td>
                    <td className="px-5 py-3 align-middle text-palacio-muted">
                      {formatFecha(ch.fecha_emision)}
                    </td>
                    <td className="px-5 py-3 align-middle text-palacio-muted">
                      {formatFecha(ch.fecha_pago)}
                    </td>
                    <td className="px-5 py-3 text-right align-middle font-medium text-zinc-900">
                      {monedaFmt.format(Number(ch.importe) || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Movimientos de tesorería */}
      <div className="palacio-card mt-6 overflow-hidden">
        <div className="border-b border-palacio-border px-5 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">
            Movimientos de tesorería generados
          </h2>
        </div>
        {movimientos.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-palacio-muted">
            Este pago no generó movimientos.
          </p>
        ) : (
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
                  <tr
                    key={m.id_movimiento}
                    className="border-b border-palacio-border last:border-0"
                  >
                    <td className="px-5 py-3 align-middle text-zinc-900">
                      {m.nombre_cuenta}
                    </td>
                    <td className="px-5 py-3 text-center align-middle text-palacio-muted">
                      {m.tipo}
                    </td>
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
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/tesoreria/pagos"
          className="palacio-btn-secondary px-4 py-2.5 text-sm"
        >
          Volver al listado
        </Link>
      </div>
    </>
  );
}

function Dato({ label, valor, full = false }) {
  return (
    <div className={`flex flex-col gap-0.5 ${full ? "md:col-span-2" : ""}`}>
      <dt className="text-xs font-medium tracking-wide text-palacio-muted uppercase">
        {label}
      </dt>
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
