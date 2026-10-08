"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ESTADOS_CAJA, badgeEstadoCaja } from "@/lib/cajas/constantes";
import { fechaHora, moneda } from "@/components/cajas/formato";

/**
 * Historial de cajas con filtros por fecha de apertura y estado.
 *
 * @param {{
 *   cajas: Array<Record<string, any>>,
 *   filtros: { desde: string, hasta: string, estado: string },
 * }} props
 */
export function CajasTable({ cajas, filtros }) {
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
            Estado
            <select value={filtros.estado} onChange={(e) => setParam("estado", e.target.value)} className="palacio-input">
              <option value="">Todos</option>
              {ESTADOS_CAJA.map((e) => (
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
        <Link href="/ventas/cajas" className="palacio-btn-primary inline-flex px-4 py-2.5 text-sm">
          Caja actual
        </Link>
      </div>

      {cajas.length === 0 ? (
        <div className="palacio-card px-6 py-12 text-center">
          <p className="text-sm text-palacio-muted">No hay cajas que coincidan con el filtro.</p>
        </div>
      ) : (
        <div className="palacio-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Listado</h2>
            <span className="text-xs text-palacio-muted">
              {cajas.length} caja{cajas.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-palacio-border bg-zinc-50/80">
                  <Th>Apertura</Th>
                  <Th>Depósito</Th>
                  <Th>Abrió</Th>
                  <Th>Cierre</Th>
                  <Th>Estado</Th>
                  <Th className="text-right">Inicial</Th>
                  <Th className="text-right">Ingresos</Th>
                  <Th className="text-right">Egresos</Th>
                  <Th className="text-right">Diferencia</Th>
                  <Th className="text-right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {cajas.map((c) => {
                  const dif = c.diferencia_efectivo == null ? null : Number(c.diferencia_efectivo);
                  return (
                    <tr key={c.id_caja} className="border-b border-palacio-border last:border-0">
                      <td className="px-5 py-4 align-middle text-zinc-900">{fechaHora(c.fecha_apertura)}</td>
                      <td className="px-5 py-4 align-middle text-zinc-800">{c.nombre_deposito || "Sin asignar"}</td>
                      <td className="px-5 py-4 align-middle text-palacio-muted">{c.abierta_por_nombre}</td>
                      <td className="px-5 py-4 align-middle text-palacio-muted">
                        {c.fecha_cierre ? `${fechaHora(c.fecha_cierre)} · ${c.cerrada_por_nombre ?? "—"}` : "—"}
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <span className={badgeEstadoCaja(c.estado)}>{c.estado}</span>
                      </td>
                      <td className="px-5 py-4 text-right align-middle">{moneda(c.monto_inicial)}</td>
                      <td className="px-5 py-4 text-right align-middle text-emerald-700">{moneda(c.total_ingresos)}</td>
                      <td className="px-5 py-4 text-right align-middle text-red-700">{moneda(c.total_egresos)}</td>
                      <td
                        className={`px-5 py-4 text-right align-middle font-medium ${dif ? "text-amber-700" : "text-zinc-900"}`}
                      >
                        {dif == null ? "—" : moneda(dif)}
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <div className="flex justify-end">
                          <Link
                            href={`/ventas/cajas/${c.id_caja}`}
                            className="palacio-action-btn palacio-action-primary"
                          >
                            Ver
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
    <th className={`px-5 py-3 text-[11px] font-semibold tracking-wider text-palacio-muted uppercase ${className}`}>
      {children}
    </th>
  );
}
