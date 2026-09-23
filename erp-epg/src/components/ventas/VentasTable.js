"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { badgeEstadoVenta, ESTADOS_VENTA } from "@/lib/ventas/estado";

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
 * V-19 · Historial de ventas mayoristas con filtros por cliente, fechas y estado.
 * En `modo="cobro"` lista solo ventas despachadas (sin filtro de estado) con la
 * acción "Cobrar", para la pantalla Registrar cobro de Tesorería.
 *
 * @param {{
 *   ventas: Array<Record<string, any>>,
 *   clientes: Array<{ id_cliente: string, nombre_cliente: string }>,
 *   filtros: { cliente: string, desde: string, hasta: string, estado?: string },
 *   modo?: "historial" | "cobro",
 * }} props
 */
export function VentasTable({ ventas, clientes, filtros, modo = "historial" }) {
  const esCobro = modo === "cobro";
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

  const hayFiltros = filtros.cliente || filtros.desde || filtros.hasta || filtros.estado;
  const total = ventas.reduce((acc, v) => acc + (Number(v.importe_total) || 0), 0);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-palacio-muted">
            Cliente
            <select
              value={filtros.cliente}
              onChange={(e) => setParam("cliente", e.target.value)}
              className="palacio-input max-w-xs"
            >
              <option value="">Todos</option>
              {clientes.map((c) => (
                <option key={c.id_cliente} value={c.id_cliente}>
                  {c.nombre_cliente}
                </option>
              ))}
            </select>
          </label>
          {esCobro ? null : (
            <label className="flex flex-col gap-1 text-xs font-medium text-palacio-muted">
              Estado
              <select
                value={filtros.estado}
                onChange={(e) => setParam("estado", e.target.value)}
                className="palacio-input"
              >
                <option value="">Todos</option>
                {ESTADOS_VENTA.map((estado) => (
                  <option key={estado} value={estado}>
                    {estado}
                  </option>
                ))}
              </select>
            </label>
          )}
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
          {hayFiltros ? (
            <button type="button" onClick={() => router.push(pathname)} className="palacio-action-btn">
              Limpiar filtros
            </button>
          ) : null}
        </div>
        {esCobro ? (
          <Link href="/tesoreria/cobranzas" className="palacio-btn-secondary inline-flex px-4 py-2.5 text-sm">
            Historial de cobros
          </Link>
        ) : (
          <Link href="/ventas/ordenes/nuevo" className="palacio-btn-primary inline-flex px-4 py-2.5 text-sm">
            Registrar venta
          </Link>
        )}
      </div>

      {ventas.length === 0 ? (
        <div className="palacio-card px-6 py-12 text-center">
          <p className="text-sm text-palacio-muted">
            {hayFiltros
              ? "No se encontraron ventas para el filtro aplicado."
              : esCobro
                ? "No hay ventas despachadas pendientes de cobro."
                : "Todavía no hay ventas registradas."}
          </p>
        </div>
      ) : (
        <div className="palacio-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Listado</h2>
            <span className="text-xs text-palacio-muted">
              {ventas.length} venta{ventas.length === 1 ? "" : "s"} · {monedaFmt.format(total)}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-palacio-border bg-zinc-50/80">
                  <Th>Fecha</Th>
                  <Th>Comprobante</Th>
                  <Th>Cliente</Th>
                  <Th className="text-center">Artículos</Th>
                  <Th className="text-right">Total</Th>
                  <Th className="text-center">Estado</Th>
                  <Th>Registrada por</Th>
                  <Th className="text-right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {ventas.map((v) => (
                  <tr key={v.id_comprobante} className="border-b border-palacio-border last:border-0">
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {formatFecha(v.fecha_comprobante)}
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <span className="text-palacio-muted">{v.nombre_tipo_comprobante}</span>
                      <span className="ml-2 font-mono text-xs text-zinc-700">{v.numero_formateado}</span>
                    </td>
                    <td className="px-5 py-4 align-middle font-medium text-zinc-900">{v.nombre_cliente}</td>
                    <td className="px-5 py-4 text-center align-middle text-palacio-muted">
                      {v.cantidad_articulos}
                    </td>
                    <td className="px-5 py-4 text-right align-middle font-medium text-zinc-900">
                      {monedaFmt.format(Number(v.importe_total) || 0)}
                    </td>
                    <td className="px-5 py-4 text-center align-middle">
                      <span className={badgeEstadoVenta(v.estado)}>{v.estado}</span>
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">{v.creado_por_nombre ?? "—"}</td>
                    <td className="px-5 py-4 align-middle">
                      {esCobro ? (
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/tesoreria/cobranzas/nuevo?venta=${v.id_comprobante}`}
                            className="palacio-action-btn palacio-action-primary"
                          >
                            Cobrar
                          </Link>
                          <Link href={`/ventas/ordenes/${v.id_comprobante}`} className="palacio-action-btn">
                            Ver venta
                          </Link>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/ventas/ordenes/${v.id_comprobante}`}
                            className="palacio-action-btn palacio-action-primary"
                          >
                            Ver detalle
                          </Link>
                          {v.estado === "Despachado" ? (
                            <Link
                              href={`/tesoreria/cobranzas/nuevo?venta=${v.id_comprobante}`}
                              className="palacio-action-btn"
                            >
                              Cobrar
                            </Link>
                          ) : null}
                        </div>
                      )}
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
