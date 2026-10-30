"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { buscarEmpleados } from "@/lib/cajas/actions";
import { ESTADOS_CAJA, badgeEstadoCaja } from "@/lib/cajas/constantes";
import { fechaHora, moneda } from "@/components/cajas/formato";
import { DesplazamientoHorizontal } from "@/components/ui/DesplazamientoHorizontal";

/**
 * Historial de cajas con filtros por fecha de apertura y estado.
 *
 * @param {{
 *   cajas: Array<Record<string, any>>,
 *   filtros: { desde: string, hasta: string, estado: string, deposito: string, empleado: string, empleadoNombre: string },
 *   depositos: Array<{ id_deposito: string, nombre_deposito: string }>,
 * }} props
 */
export function CajasTable({ cajas, filtros, depositos = [] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParams(cambios) {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(cambios)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function setParam(key, value) {
    setParams({ [key]: value });
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-palacio-muted">
            Depósito
            <select
              value={filtros.deposito}
              onChange={(e) => setParam("deposito", e.target.value)}
              className="palacio-input min-w-44"
            >
              <option value="">Todos</option>
              {depositos.map((d) => (
                <option key={d.id_deposito} value={d.id_deposito}>
                  {d.nombre_deposito}
                </option>
              ))}
            </select>
          </label>
          <EmpleadoBuscador
            nombre={filtros.empleadoNombre}
            onElegir={(empleado) =>
              setParams({ empleado: empleado.id_usuario, empleadoNombre: empleado.nombre_completo })
            }
            onQuitar={() => setParams({ empleado: "", empleadoNombre: "" })}
          />
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
        <div className="palacio-card">
          <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Listado</h2>
            <span className="text-xs text-palacio-muted">
              {cajas.length} caja{cajas.length === 1 ? "" : "s"}
            </span>
          </div>
          <DesplazamientoHorizontal>
            <table className="min-w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-palacio-border bg-zinc-50/80">
                  <Th>Apertura</Th>
                  <Th>Estado</Th>
                  <Th>Depósito</Th>
                  <Th>Abrió</Th>
                  <Th className="text-right">Diferencia</Th>
                  <Th className="text-right">Inicial</Th>
                  <Th className="text-right">Ingresos</Th>
                  <Th className="text-right">Egresos</Th>
                  <Th>Cierre</Th>
                  <Th className="sticky right-0 bg-zinc-50 text-right shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.12)]">
                    Acciones
                  </Th>
                </tr>
              </thead>
              <tbody>
                {cajas.map((c) => {
                  const dif = c.diferencia_efectivo == null ? null : Number(c.diferencia_efectivo);
                  return (
                    <tr key={c.id_caja} className="border-b border-palacio-border last:border-0">
                      <td className="px-5 py-4 align-middle text-zinc-900">{fechaHora(c.fecha_apertura)}</td>
                      <td className="px-5 py-4 align-middle">
                        <span className={badgeEstadoCaja(c.estado)}>{c.estado}</span>
                      </td>
                      <td className="px-5 py-4 align-middle text-zinc-800">{c.nombre_deposito || "Sin asignar"}</td>
                      <td className="px-5 py-4 align-middle text-palacio-muted">{c.abierta_por_nombre}</td>
                      <td
                        className={`px-5 py-4 text-right align-middle font-medium ${dif ? "text-amber-700" : "text-zinc-900"}`}
                      >
                        {dif == null ? "—" : moneda(dif)}
                      </td>
                      <td className="px-5 py-4 text-right align-middle">{moneda(c.monto_inicial)}</td>
                      <td className="px-5 py-4 text-right align-middle text-emerald-700">{moneda(c.total_ingresos)}</td>
                      <td className="px-5 py-4 text-right align-middle text-red-700">{moneda(c.total_egresos)}</td>
                      <td className="px-5 py-4 align-middle text-palacio-muted">
                        {c.fecha_cierre ? `${fechaHora(c.fecha_cierre)} · ${c.cerrada_por_nombre ?? "—"}` : "—"}
                      </td>
                      <td className="sticky right-0 bg-white px-5 py-4 align-middle shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.12)]">
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
          </DesplazamientoHorizontal>
        </div>
      )}
    </>
  );
}

function EmpleadoBuscador({ nombre, onElegir, onQuitar }) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState([]);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) return;
    let vigente = true;
    const t = setTimeout(() => {
      buscarEmpleados(query.trim()).then(({ data, error }) => {
        if (!vigente) return;
        if (!error) {
          setResultados(data ?? []);
          setAbierto(true);
        }
      });
    }, 300);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [query]);

  if (nombre) {
    return (
      <div className="flex flex-col gap-1 text-xs font-medium text-palacio-muted">
        Empleado
        <div className="flex h-[42px] items-center justify-between gap-2 rounded-md border border-palacio-border bg-zinc-50 px-3">
          <span className="text-sm text-zinc-900">{nombre}</span>
          <button type="button" onClick={onQuitar} className="text-xs font-medium text-palacio-muted hover:text-zinc-900">
            Quitar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col gap-1 text-xs font-medium text-palacio-muted">
      Empleado
      <input
        type="text"
        value={query}
        onChange={(e) => {
          const valor = e.target.value;
          setQuery(valor);
          if (valor.trim().length < 2) {
            setResultados([]);
            setAbierto(false);
          }
        }}
        onFocus={() => resultados.length > 0 && setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
        placeholder="Nombre del empleado…"
        className="palacio-input min-w-52"
      />
      {abierto && resultados.length > 0 ? (
        <ul className="absolute top-full z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border border-palacio-border bg-white shadow-lg">
          {resultados.map((e) => (
            <li key={e.id_usuario}>
              <button
                type="button"
                onMouseDown={() => onElegir(e)}
                className="w-full border-b border-palacio-border px-3 py-2 text-left text-sm text-zinc-900 last:border-0 hover:bg-zinc-50"
              >
                {e.nombre_completo}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {abierto && query.trim().length >= 2 && resultados.length === 0 ? (
        <div className="absolute top-full z-10 mt-1 w-full rounded-md border border-palacio-border bg-white px-3 py-2 text-sm text-palacio-muted shadow-lg">
          Sin coincidencias.
        </div>
      ) : null}
    </div>
  );
}

function Th({ children, className = "" }) {
  return (
    <th className={`px-5 py-3 text-[11px] font-semibold tracking-wider text-palacio-muted uppercase ${className}`}>
      {children}
    </th>
  );
}
