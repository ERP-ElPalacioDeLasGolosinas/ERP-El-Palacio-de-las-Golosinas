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
 *   pagos: Array<Record<string, any>>,
 *   proveedores: Array<{ id_proveedor: string, nombre_proveedor: string }>,
 *   filtros: { proveedor: string, desde: string, hasta: string },
 * }} props
 */
export function PagosTable({ pagos, proveedores, filtros }) {
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

      {pagos.length === 0 ? (
        <div className="palacio-card px-6 py-12 text-center">
          <p className="text-sm text-palacio-muted">
            No hay pagos que coincidan con el filtro. Los pagos se registran
            desde una orden de pago en estado “Pendiente de pago”.
          </p>
        </div>
      ) : (
        <div className="palacio-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Listado</h2>
            <span className="text-xs text-palacio-muted">
              {pagos.length} pago{pagos.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-palacio-border bg-zinc-50/80">
                  <Th>Fecha</Th>
                  <Th>Proveedor</Th>
                  <Th className="text-center">Comprob.</Th>
                  <Th className="text-right">Importe</Th>
                  <Th>Registrado por</Th>
                  <Th className="text-right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {pagos.map((p) => (
                  <tr
                    key={p.id_pago}
                    className="border-b border-palacio-border last:border-0"
                  >
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {formatFecha(p.fecha_pago)}
                    </td>
                    <td className="px-5 py-4 align-middle font-medium text-zinc-900">
                      {p.nombre_proveedor}
                    </td>
                    <td className="px-5 py-4 text-center align-middle text-palacio-muted">
                      {p.cantidad_comprobantes}
                    </td>
                    <td className="px-5 py-4 text-right align-middle font-medium text-zinc-900">
                      {monedaFmt.format(Number(p.importe_total) || 0)}
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {p.creado_por_nombre ?? "—"}
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link
                          href={`/tesoreria/pagos/${p.id_pago}`}
                          className="palacio-action-btn palacio-action-primary"
                        >
                          Ver
                        </Link>
                        <Link
                          href={`/tesoreria/ordenes-de-pago/${p.id_orden_pago}`}
                          className="palacio-action-btn"
                        >
                          Orden
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
