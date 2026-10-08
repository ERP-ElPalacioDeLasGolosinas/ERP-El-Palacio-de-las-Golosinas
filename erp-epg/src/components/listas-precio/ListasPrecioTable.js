"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  BADGE_POR_VENCER,
  ESTADOS_LISTA,
  TIPOS_LISTA,
  badgeEstadoLista,
  formatFechaLista,
} from "@/lib/listas-precio/constantes";

/**
 * A-11 · Listado de listas de precios con filtros por tipo y estado en la URL.
 *
 * @param {{
 *   listas: Array<Record<string, any>>,
 *   filtros: { tipo: string, estado: string },
 * }} props
 */
export function ListasPrecioTable({ listas, filtros }) {
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

  const hayFiltros = filtros.tipo || filtros.estado;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-palacio-muted">
            Tipo
            <select
              value={filtros.tipo}
              onChange={(e) => setParam("tipo", e.target.value)}
              className="palacio-input"
            >
              <option value="">Todos</option>
              {TIPOS_LISTA.map((t) => (
                <option key={t} value={t}>
                  {t}
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
              {ESTADOS_LISTA.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </label>
          {hayFiltros ? (
            <button type="button" onClick={() => router.push(pathname)} className="palacio-action-btn">
              Limpiar filtros
            </button>
          ) : null}
        </div>
        <Link
          href="/ventas/listas-de-precios/nuevo"
          className="palacio-btn-primary inline-flex px-4 py-2.5 text-sm"
        >
          Nueva lista de precios
        </Link>
      </div>

      {listas.length === 0 ? (
        <div className="palacio-card px-6 py-12 text-center">
          <p className="text-sm text-palacio-muted">
            {hayFiltros
              ? "No se encontraron listas para el filtro aplicado."
              : "Todavía no hay listas de precios."}
          </p>
        </div>
      ) : (
        <div className="palacio-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Listado</h2>
            <span className="text-xs text-palacio-muted">
              {listas.length} lista{listas.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-palacio-border bg-zinc-50/80">
                  <Th>Nombre</Th>
                  <Th>Tipo</Th>
                  <Th>Inicio</Th>
                  <Th>Fin</Th>
                  <Th className="text-center">Artículos</Th>
                  <Th className="text-center">Estado</Th>
                  <Th>Creada por</Th>
                  <Th className="text-right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {listas.map((l) => (
                  <tr
                    key={l.id_lista_precio}
                    className={[
                      "border-b border-palacio-border last:border-0",
                      l.estado_vigencia === "Vencida" ? "opacity-60" : "",
                    ].join(" ")}
                  >
                    <td className="px-5 py-4 align-middle font-medium text-zinc-900">
                      {l.nombre_lista_precio}
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">{l.tipo_lista}</td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {formatFechaLista(l.fecha_inicio)}
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {l.fecha_fin ? formatFechaLista(l.fecha_fin) : "Sin fin"}
                    </td>
                    <td className="px-5 py-4 text-center align-middle text-palacio-muted">
                      {l.cantidad_articulos}
                    </td>
                    <td className="px-5 py-4 text-center align-middle">
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        <span className={badgeEstadoLista(l.estado_vigencia)}>{l.estado_vigencia}</span>
                        {l.por_vencer ? <span className={BADGE_POR_VENCER}>Por vencer</span> : null}
                      </div>
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {l.creado_por_nombre ?? "—"}
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <div className="flex justify-end">
                        <Link
                          href={`/ventas/listas-de-precios/${l.id_lista_precio}`}
                          className="palacio-action-btn palacio-action-primary"
                        >
                          {l.estado_vigencia === "Vencida" ? "Ver" : "Ver / editar"}
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
