"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { badgeEstadoPedidoWeb } from "@/lib/pedidos-web/estado";
import { DesplazamientoHorizontal } from "@/components/ui/DesplazamientoHorizontal";

const fechaFmt = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const monedaFmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

function formatFecha(valor) {
  if (!valor) return "—";
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? "—" : fechaFmt.format(d);
}

/**
 * @param {{
 *   pedidos: Array<Record<string, any>>,
 *   filtros: { desde: string, hasta: string },
 * }} props
 */
export function PedidosWebTable({ pedidos, filtros }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key, value) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
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

      {pedidos.length === 0 ? (
        <div className="palacio-card px-6 py-12 text-center">
          <p className="text-sm text-palacio-muted">No hay pedidos web que coincidan con el filtro.</p>
        </div>
      ) : (
        <div className="palacio-card">
          <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Listado</h2>
            <span className="flex items-center gap-3 text-xs text-palacio-muted">
              {pedidos.length} pedido{pedidos.length === 1 ? "" : "s"}
            </span>
          </div>
          <DesplazamientoHorizontal>
            <table className="min-w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-palacio-border bg-zinc-50/80">
                  <Th>N.º</Th>
                  <Th>Fecha</Th>
                  <Th>Cliente</Th>
                  <Th>Estado</Th>
                  <Th>Entrega</Th>
                  <Th>Medio de pago</Th>
                  <Th className="text-right">Líneas</Th>
                  <Th className="text-right">Importe</Th>
                  <Th className="text-right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((p) => (
                  <tr key={p.id_pedido} className="border-b border-palacio-border last:border-0">
                    <td className="px-5 py-4 align-middle font-mono text-xs text-zinc-700">{p.numero}</td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">{formatFecha(p.creado)}</td>
                    <td className="px-5 py-4 align-middle font-medium text-zinc-900">{p.nombre_cliente}</td>
                    <td className="px-5 py-4 align-middle">
                      <span className={badgeEstadoPedidoWeb(p.estado)}>{p.estado}</span>
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {p.tipo_entrega === "Retiro por sucursal" && p.nombre_deposito_retiro
                        ? `Retiro · ${p.nombre_deposito_retiro}`
                        : (p.tipo_entrega ?? "—")}
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">{p.medio_pago}</td>
                    <td className="px-5 py-4 text-right align-middle text-palacio-muted">
                      {Number(p.cantidad_lineas)}
                    </td>
                    <td className="px-5 py-4 text-right align-middle font-medium text-zinc-900">
                      {monedaFmt.format(Number(p.importe_total) || 0)}
                    </td>
                    <td className="px-5 py-4 text-right align-middle">
                      <Link
                        href={`/ventas/pedidos-web/${p.id_pedido}`}
                        className="palacio-action-btn palacio-action-primary"
                      >
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DesplazamientoHorizontal>
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
