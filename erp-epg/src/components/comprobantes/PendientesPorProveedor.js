"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
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
  const d = new Date(`${valor}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "—" : fechaFmt.format(d);
}

/**
 * @param {{
 *   comprobantes: Array<Record<string, any>>,
 *   resumen: { cantidad: number, saldo_pendiente: number } | null,
 *   proveedores: Array<{ id_proveedor: string, nombre_proveedor: string }>,
 *   filtros: { proveedor: string, orden: string },
 * }} props
 */
export function PendientesPorProveedor({
  comprobantes,
  resumen,
  proveedores,
  filtros,
}) {
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

  const orden = filtros.orden === "vencimiento" ? "vencimiento" : "fecha";

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
            <option value="">Elegí un proveedor…</option>
            {proveedores.map((p) => (
              <option key={p.id_proveedor} value={p.id_proveedor}>
                {p.nombre_proveedor}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-palacio-muted">
          Ordenar por
          <select
            value={orden}
            onChange={(e) => setParam("orden", e.target.value)}
            className="palacio-input"
          >
            <option value="fecha">Fecha del comprobante</option>
            <option value="vencimiento">Vencimiento</option>
          </select>
        </label>
      </div>

      {!filtros.proveedor ? (
        <div className="palacio-card px-6 py-12 text-center">
          <p className="text-sm text-palacio-muted">
            Elegí un proveedor para ver sus comprobantes con saldo pendiente.
          </p>
        </div>
      ) : (
        <>
          {resumen ? (
            <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-md">
              <ResumenItem
                label="Comprobantes"
                valor={String(resumen.cantidad)}
              />
              <ResumenItem
                label="Saldo pendiente"
                valor={monedaFmt.format(resumen.saldo_pendiente)}
              />
            </div>
          ) : null}

          {comprobantes.length === 0 ? (
            <div className="palacio-card px-6 py-12 text-center">
              <p className="text-sm text-palacio-muted">
                Este proveedor no tiene comprobantes con saldo pendiente.
              </p>
            </div>
          ) : (
            <div className="palacio-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
                <h2 className="text-sm font-semibold text-zinc-900">
                  Pendientes de pago
                </h2>
                <span className="text-xs text-palacio-muted">
                  {comprobantes.length} comprobante
                  {comprobantes.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-palacio-border bg-zinc-50/80">
                      <Th>Tipo</Th>
                      <Th>Número</Th>
                      <Th>Fecha</Th>
                      <Th>Vencimiento</Th>
                      <Th className="text-right">Total</Th>
                      <Th className="text-right">Saldo</Th>
                      <Th className="text-center">Estado</Th>
                      <Th className="text-right">Acciones</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {comprobantes.map((c) => (
                      <tr
                        key={c.id_comprobante}
                        className="border-b border-palacio-border last:border-0"
                      >
                        <td className="px-5 py-4 align-middle text-palacio-muted">
                          {c.nombre_tipo_comprobante}
                          {c.letra ? ` (${c.letra})` : ""}
                        </td>
                        <td className="px-5 py-4 align-middle">
                          <span className="font-mono text-xs text-zinc-700">
                            {c.numero_formateado}
                          </span>
                        </td>
                        <td className="px-5 py-4 align-middle text-palacio-muted">
                          {formatFecha(c.fecha_comprobante)}
                        </td>
                        <td className="px-5 py-4 align-middle text-palacio-muted">
                          {formatFecha(c.fecha_vencimiento)}
                        </td>
                        <td className="px-5 py-4 text-right align-middle">
                          {monedaFmt.format(Number(c.importe_total) || 0)}
                        </td>
                        <td className="px-5 py-4 text-right align-middle font-medium text-zinc-900">
                          {monedaFmt.format(Number(c.saldo_pendiente) || 0)}
                        </td>
                        <td className="px-5 py-4 text-center align-middle">
                          <span className={badgeEstadoComprobante(c.estado)}>
                            {c.estado}
                          </span>
                        </td>
                        <td className="px-5 py-4 align-middle">
                          <div className="flex justify-end">
                            <Link
                              href={`/compras/comprobantes/${c.id_comprobante}`}
                              className="palacio-action-btn"
                            >
                              Ver detalle
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
      )}
    </>
  );
}

function ResumenItem({ label, valor }) {
  return (
    <div className="rounded-lg border border-palacio-border bg-zinc-50/60 px-4 py-3">
      <p className="text-[11px] font-semibold tracking-wider text-palacio-muted uppercase">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-zinc-900 tabular-nums">
        {valor}
      </p>
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
