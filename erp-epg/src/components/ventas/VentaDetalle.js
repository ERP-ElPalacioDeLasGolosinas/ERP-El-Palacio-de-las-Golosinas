"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { despacharVenta } from "@/lib/ventas/actions";
import { mapErrorVenta } from "@/lib/ventas/errores";
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
 * V-19 · Detalle de una venta mayorista: comprobante, cliente, artículos con su
 * depósito y cobro. Permite despacharla y, ya despachada, ir a cobrarla.
 *
 * @param {{
 *   venta: Record<string, any>,
 *   detalle: Array<Record<string, any>>,
 *   cobro: Record<string, any> | null,
 * }} props
 */
export function VentaDetalle({ venta, detalle, cobro }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(null);

  function despachar() {
    const ok = window.confirm(
      `¿Marcar como despachada la venta ${venta.numero_formateado} a ${venta.nombre_cliente}?`
    );
    if (!ok) return;

    setError(null);
    startTransition(async () => {
      const result = await despacharVenta(venta.id_comprobante);
      if (!result.ok) {
        setError(mapErrorVenta(result).message);
      }
      router.refresh();
    });
  }

  return (
    <>
      <div className="palacio-card p-5 md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-zinc-900">
              {venta.nombre_tipo_comprobante}{" "}
              <span className="font-mono text-xs text-zinc-700">{venta.numero_formateado}</span>
            </h2>
            <span className={badgeEstadoVenta(venta.estado)}>{venta.estado}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {venta.estado === "En preparación" ? (
              <button
                type="button"
                onClick={despachar}
                disabled={pending}
                className="palacio-btn-primary px-4 py-2 text-sm"
              >
                {pending ? "Despachando…" : "Marcar como despachada"}
              </button>
            ) : null}
            {venta.estado === "Despachado" ? (
              <Link
                href={`/tesoreria/cobranzas/nuevo?venta=${venta.id_comprobante}`}
                className="palacio-btn-primary inline-flex px-4 py-2 text-sm"
              >
                Registrar cobro
              </Link>
            ) : null}
          </div>
        </div>

        {error ? (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <dl className="grid gap-4 text-sm md:grid-cols-3">
          <Dato label="Cliente" valor={venta.nombre_cliente} />
          <Dato label="Documento" valor={venta.documento_cliente} />
          <Dato label="Tipo de cliente" valor={venta.nombre_tipo_cliente} />
          <Dato label="Fecha" valor={formatFecha(venta.fecha_comprobante)} />
          <Dato label="Canal" valor={venta.canal} />
          <Dato label="Despachada" valor={venta.fecha_despacho ? formatFecha(venta.fecha_despacho) : "—"} />
          <Dato label="Registrada por" valor={venta.creado_por_nombre} />
          <Dato label="Registrada" valor={formatFecha(venta.creado)} />
          <Dato label="Total" valor={monedaFmt.format(Number(venta.importe_total) || 0)} />
          {venta.observaciones ? <Dato label="Observaciones" valor={venta.observaciones} full /> : null}
        </dl>
      </div>

      <div className="palacio-card mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">Artículos</h2>
          <span className="text-xs text-palacio-muted">
            {detalle.length} línea{detalle.length === 1 ? "" : "s"} · stock descontado con “Salida por venta”
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-palacio-border bg-zinc-50/80">
                <Th>Código</Th>
                <Th>Artículo</Th>
                <Th>Depósito</Th>
                <Th className="text-right">Cantidad</Th>
                <Th className="text-right">Precio</Th>
                <Th className="text-right">Descuento</Th>
                <Th className="text-right">Importe</Th>
              </tr>
            </thead>
            <tbody>
              {detalle.map((d) => (
                <tr key={d.id_detalle} className="border-b border-palacio-border last:border-0">
                  <td className="px-5 py-3 align-middle font-mono text-xs text-zinc-700">{d.codigo_producto}</td>
                  <td className="px-5 py-3 align-middle text-zinc-900">{d.nombre_completo}</td>
                  <td className="px-5 py-3 align-middle text-palacio-muted">{d.nombre_deposito}</td>
                  <td className="px-5 py-3 text-right align-middle">{Number(d.cantidad)}</td>
                  <td className="px-5 py-3 text-right align-middle text-palacio-muted">
                    {monedaFmt.format(Number(d.precio_unitario) || 0)}
                  </td>
                  <td className="px-5 py-3 text-right align-middle text-palacio-muted">
                    {monedaFmt.format(Number(d.descuento) || 0)}
                  </td>
                  <td className="px-5 py-3 text-right align-middle font-medium text-zinc-900">
                    {monedaFmt.format(Number(d.importe_linea) || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <FilaTotal label="Subtotal" valor={venta.subtotal} />
              <FilaTotal label="Descuentos" valor={venta.descuento_total} />
              <FilaTotal label="Total" valor={venta.importe_total} fuerte />
            </tfoot>
          </table>
        </div>
      </div>

      <div className="palacio-card mt-6 p-5 md:p-6">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">Cobro</h2>
        {cobro ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <p className="text-zinc-900">
                Cobrada el {formatFecha(cobro.fecha_cobro)} por{" "}
                {monedaFmt.format(Number(cobro.importe_total) || 0)} · {cobro.creado_por_nombre}
              </p>
              <Link href={`/tesoreria/cobranzas/${cobro.id_cobro}`} className="palacio-action-btn palacio-action-primary">
                Ver cobro
              </Link>
            </div>
            {cobro.medios?.length ? (
              <ul className="mt-3 divide-y divide-palacio-border rounded-lg border border-palacio-border text-sm">
                {cobro.medios.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                    <span className="text-zinc-900">
                      {m.nombre_medio_pago}
                      <span className="text-palacio-muted">
                        {" "}
                        · {m.nombre_cuenta}
                        {m.referencia ? ` · Ref. ${m.referencia}` : ""}
                      </span>
                    </span>
                    <span className="font-medium text-zinc-900">
                      {monedaFmt.format(Number(m.importe) || 0)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-palacio-muted">
            {venta.estado === "Despachado"
              ? "Pendiente de cobro. Registralo en Tesorería con el botón “Registrar cobro”."
              : "Se podrá cobrar una vez que la venta esté despachada."}
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/ventas/ordenes" className="palacio-btn-secondary px-4 py-2.5 text-sm">
          Volver al historial
        </Link>
      </div>
    </>
  );
}

function FilaTotal({ label, valor, fuerte = false }) {
  return (
    <tr className="border-t border-palacio-border bg-zinc-50/60">
      <td className="px-5 py-2 text-right font-medium text-palacio-muted" colSpan={6}>
        {label}
      </td>
      <td className={`px-5 py-2 text-right text-zinc-900 ${fuerte ? "font-semibold" : ""}`}>
        {monedaFmt.format(Number(valor) || 0)}
      </td>
    </tr>
  );
}

function Dato({ label, valor, full = false }) {
  return (
    <div className={`flex flex-col gap-0.5 ${full ? "md:col-span-3" : ""}`}>
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
