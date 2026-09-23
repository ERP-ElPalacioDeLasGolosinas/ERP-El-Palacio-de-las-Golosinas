"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

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
 * @param {{
 *   cobros: Array<Record<string, any>>,
 *   clientes: Array<{ id_cliente: string, nombre_cliente: string }>,
 *   filtros: { cliente: string, desde: string, hasta: string },
 * }} props
 */
export function CobrosTable({ cobros, clientes, filtros }) {
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
        <Link href="/tesoreria/cobranzas/nuevo" className="palacio-btn-primary inline-flex px-4 py-2.5 text-sm">
          Registrar cobro
        </Link>
      </div>

      {cobros.length === 0 ? (
        <div className="palacio-card px-6 py-12 text-center">
          <p className="text-sm text-palacio-muted">
            No hay cobros que coincidan con el filtro. Los cobros se registran sobre ventas despachadas.
          </p>
        </div>
      ) : (
        <div className="palacio-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Listado</h2>
            <span className="text-xs text-palacio-muted">
              {cobros.length} cobro{cobros.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-palacio-border bg-zinc-50/80">
                  <Th>Fecha</Th>
                  <Th>Cliente</Th>
                  <Th>Venta</Th>
                  <Th>Medios</Th>
                  <Th className="text-right">Importe</Th>
                  <Th>Registrado por</Th>
                  <Th className="text-right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {cobros.map((c) => (
                  <tr key={c.id_cobro} className="border-b border-palacio-border last:border-0">
                    <td className="px-5 py-4 align-middle text-palacio-muted">{formatFecha(c.fecha_cobro)}</td>
                    <td className="px-5 py-4 align-middle font-medium text-zinc-900">{c.nombre_cliente}</td>
                    <td className="px-5 py-4 align-middle">
                      <span className="text-palacio-muted">{c.nombre_tipo_comprobante}</span>
                      <span className="ml-2 font-mono text-xs text-zinc-700">{c.numero_formateado}</span>
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">{c.medios ?? "—"}</td>
                    <td className="px-5 py-4 text-right align-middle font-medium text-zinc-900">
                      {monedaFmt.format(Number(c.importe_total) || 0)}
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">{c.creado_por_nombre ?? "—"}</td>
                    <td className="px-5 py-4 align-middle">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link
                          href={`/tesoreria/cobranzas/${c.id_cobro}`}
                          className="palacio-action-btn palacio-action-primary"
                        >
                          Ver
                        </Link>
                        <Link href={`/ventas/ordenes/${c.id_comprobante}`} className="palacio-action-btn">
                          Venta
                        </Link>
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
