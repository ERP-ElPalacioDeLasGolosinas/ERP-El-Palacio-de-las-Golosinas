"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cancelarOrdenPago } from "@/lib/ordenes-pago/actions";
import { mapErrorOrdenPago } from "@/lib/ordenes-pago/errores";
import {
  ESTADOS_ORDEN_PAGO,
  badgeEstadoOrdenPago,
} from "@/lib/ordenes-pago/constantes";

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

const CANCELABLES = new Set([
  "Borrador",
  "Pendiente de pago",
  "Pagada parcial",
]);

/**
 * @param {{
 *   ordenes: Array<Record<string, any>>,
 *   proveedores: Array<{ id_proveedor: string, nombre_proveedor: string }>,
 *   filtros: { proveedor: string, estado: string, desde: string, hasta: string },
 * }} props
 */
export function OrdenesPagoTable({ ordenes, proveedores, filtros }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function setParam(key, value) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function cancelar(orden) {
    const ok = window.confirm(
      `¿Cancelar la orden de pago de ${orden.nombre_proveedor} por ${monedaFmt.format(
        Number(orden.importe_total) || 0
      )}? Los comprobantes imputados vuelven a Pendiente.`
    );
    if (!ok) return;

    startTransition(async () => {
      const result = await cancelarOrdenPago(orden.id_orden_pago);
      if (!result.ok) {
        const ui = mapErrorOrdenPago(result);
        window.alert(ui.message);
      }
      router.refresh();
    });
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-palacio-muted">
            Proveedor
            <select
              value={filtros.proveedor}
              onChange={(e) => setParam("proveedor", e.target.value)}
              className="palacio-input max-w-xs"
            >
              <option value="">Todos</option>
              {proveedores.map((p) => (
                <option key={p.id_proveedor} value={p.id_proveedor}>
                  {p.nombre_proveedor}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-palacio-muted">
            Estado
            <select
              value={filtros.estado}
              onChange={(e) => setParam("estado", e.target.value)}
              className="palacio-input"
            >
              <option value="">Todos</option>
              {ESTADOS_ORDEN_PAGO.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-palacio-muted">
            Desde
            <input
              type="date"
              value={filtros.desde}
              onChange={(e) => setParam("desde", e.target.value)}
              className="palacio-input"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-palacio-muted">
            Hasta
            <input
              type="date"
              value={filtros.hasta}
              onChange={(e) => setParam("hasta", e.target.value)}
              className="palacio-input"
            />
          </label>
        </div>
        <Link
          href="/tesoreria/ordenes-de-pago/nuevo"
          className="palacio-btn-primary inline-flex px-4 py-2.5 text-sm"
        >
          Nueva orden de pago
        </Link>
      </div>

      {ordenes.length === 0 ? (
        <div className="palacio-card px-6 py-12 text-center">
          <p className="text-sm text-palacio-muted">
            No hay órdenes de pago que coincidan con el filtro.
          </p>
        </div>
      ) : (
        <div className="palacio-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Listado</h2>
            <span className="text-xs text-palacio-muted">
              {ordenes.length} orden{ordenes.length === 1 ? "" : "es"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-palacio-border bg-zinc-50/80">
                  <Th>Creada</Th>
                  <Th>Proveedor</Th>
                  <Th>Referencia</Th>
                  <Th className="text-center">Comprob.</Th>
                  <Th className="text-right">Importe</Th>
                  <Th className="text-center">Estado</Th>
                  <Th>Creada por</Th>
                  <Th className="text-right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {ordenes.map((o) => (
                  <tr
                    key={o.id_orden_pago}
                    className="border-b border-palacio-border last:border-0"
                  >
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {formatFecha(o.creado)}
                    </td>
                    <td className="px-5 py-4 align-middle font-medium text-zinc-900">
                      {o.nombre_proveedor}
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {o.referencia || "—"}
                    </td>
                    <td className="px-5 py-4 text-center align-middle text-palacio-muted">
                      {o.cantidad_comprobantes}
                    </td>
                    <td className="px-5 py-4 text-right align-middle font-medium text-zinc-900">
                      {monedaFmt.format(Number(o.importe_total) || 0)}
                    </td>
                    <td className="px-5 py-4 text-center align-middle">
                      <span className={badgeEstadoOrdenPago(o.estado)}>
                        {o.estado}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {o.creado_por_nombre ?? "—"}
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link
                          href={`/tesoreria/ordenes-de-pago/${o.id_orden_pago}`}
                          className="palacio-action-btn palacio-action-primary"
                        >
                          Ver
                        </Link>
                        {CANCELABLES.has(o.estado) ? (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => cancelar(o)}
                            className="palacio-action-btn palacio-action-danger"
                          >
                            Cancelar
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
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
