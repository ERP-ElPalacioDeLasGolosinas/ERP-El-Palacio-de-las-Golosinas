"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  confirmarOrdenPago,
  cancelarOrdenPago,
} from "@/lib/ordenes-pago/actions";
import { mapErrorOrdenPago } from "@/lib/ordenes-pago/errores";
import { badgeEstadoOrdenPago } from "@/lib/ordenes-pago/constantes";
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
  const d = new Date(valor.length <= 10 ? `${valor}T00:00:00` : valor);
  return Number.isNaN(d.getTime()) ? "—" : fechaFmt.format(d);
}

const CANCELABLES = new Set(["Borrador", "Pendiente de pago", "Pagada parcial"]);
const PAGABLES = new Set(["Pendiente de pago", "Pagada parcial"]);

/**
 * T-07 · Detalle de una orden de pago: cabecera, comprobantes imputados y
 * medios de pago. Confirmar (solo Borrador) y Cancelar (revierte los
 * comprobantes).
 *
 * @param {{
 *   orden: Record<string, any>,
 *   comprobantes: Array<Record<string, any>>,
 *   medios: Array<Record<string, any>>,
 * }} props
 */
export function OrdenPagoDetalle({ orden, comprobantes, medios }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const totalImputado = comprobantes.reduce(
    (acc, c) => acc + (Number(c.importe_imputado) || 0),
    0
  );
  const totalMedios = medios.reduce(
    (acc, m) => acc + (Number(m.importe) || 0),
    0
  );

  function accion(fn, confirmMsg) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    startTransition(async () => {
      const result = await fn(orden.id_orden_pago);
      if (!result.ok) {
        window.alert(mapErrorOrdenPago(result).message);
      }
      router.refresh();
    });
  }

  return (
    <>
      <div className="palacio-card p-5 md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-900">
            Datos de la orden
          </h2>
          <span className={badgeEstadoOrdenPago(orden.estado)}>
            {orden.estado}
          </span>
        </div>

        <dl className="grid gap-4 text-sm md:grid-cols-2">
          <Dato label="Proveedor" valor={orden.nombre_proveedor} />
          <Dato label="Importe total" valor={monedaFmt.format(Number(orden.importe_total) || 0)} />
          <Dato label="Fecha prevista de pago" valor={formatFecha(orden.fecha_prevista)} />
          <Dato label="Referencia" valor={orden.referencia} />
          <Dato label="Creada" valor={formatFecha(orden.creado)} />
          <Dato label="Creada por" valor={orden.creado_por_nombre} />
          {orden.observaciones ? (
            <Dato label="Observaciones" valor={orden.observaciones} full />
          ) : null}
        </dl>
      </div>

      {/* Comprobantes imputados */}
      <div className="palacio-card mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">
            Comprobantes imputados
          </h2>
          <span className="text-xs text-palacio-muted">
            {comprobantes.length} comprobante{comprobantes.length === 1 ? "" : "s"}
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
                <Th className="text-right">Imputado</Th>
              </tr>
            </thead>
            <tbody>
              {comprobantes.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-palacio-border last:border-0"
                >
                  <td className="px-5 py-3 align-middle">
                    <span className="font-mono text-xs text-zinc-700">
                      {c.numero_formateado}
                    </span>
                    <span className="ml-2 text-palacio-muted">
                      {c.nombre_tipo_comprobante}
                      {c.letra ? ` (${c.letra})` : ""}
                    </span>
                  </td>
                  <td className="px-5 py-3 align-middle text-palacio-muted">
                    {formatFecha(c.fecha_vencimiento)}
                  </td>
                  <td className="px-5 py-3 text-center align-middle">
                    <span className={badgeEstadoComprobante(c.estado)}>
                      {c.estado}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right align-middle text-palacio-muted">
                    {monedaFmt.format(Number(c.saldo_pendiente) || 0)}
                  </td>
                  <td className="px-5 py-3 text-right align-middle font-medium text-zinc-900">
                    {monedaFmt.format(Number(c.importe_imputado) || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-palacio-border bg-zinc-50/60">
                <td className="px-5 py-3 text-right font-medium text-palacio-muted" colSpan={4}>
                  Total imputado
                </td>
                <td className="px-5 py-3 text-right font-semibold text-zinc-900">
                  {monedaFmt.format(totalImputado)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Medios de pago */}
      <div className="palacio-card mt-6 overflow-hidden">
        <div className="border-b border-palacio-border px-5 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">Medios de pago</h2>
        </div>
        {medios.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-palacio-muted">
            La orden todavía no tiene medios de pago cargados.
          </p>
        ) : (
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
                  <td className="px-5 py-3 text-right font-medium text-palacio-muted" colSpan={3}>
                    Total medios
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-zinc-900">
                    {monedaFmt.format(totalMedios)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => router.push("/tesoreria/ordenes-de-pago")}
          className="palacio-btn-secondary px-4 py-2.5 text-sm"
        >
          Volver al listado
        </button>
        {PAGABLES.has(orden.estado) ? (
          <Link
            href={`/tesoreria/pagos/nuevo?orden=${orden.id_orden_pago}`}
            className="palacio-btn-primary px-4 py-2.5 text-sm"
          >
            Registrar pago
          </Link>
        ) : null}
        {orden.estado === "Borrador" ? (
          <button
            type="button"
            onClick={() =>
              accion(
                confirmarOrdenPago,
                "¿Confirmar la orden? Los comprobantes imputados pasan a “En orden de pago”."
              )
            }
            disabled={pending}
            className="palacio-btn-primary px-4 py-2.5 text-sm"
          >
            {pending ? "Procesando…" : "Confirmar orden"}
          </button>
        ) : null}
        {CANCELABLES.has(orden.estado) ? (
          <button
            type="button"
            onClick={() =>
              accion(
                cancelarOrdenPago,
                "¿Cancelar la orden? Los comprobantes imputados vuelven a Pendiente."
              )
            }
            disabled={pending}
            className="palacio-btn-secondary px-4 py-2.5 text-sm"
          >
            Cancelar orden
          </button>
        ) : null}
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
