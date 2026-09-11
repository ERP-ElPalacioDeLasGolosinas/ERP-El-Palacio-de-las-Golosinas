"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { anularComprobante } from "@/lib/comprobantes/actions";
import { mapErrorComprobante } from "@/lib/comprobantes/errores";
import {
  badgeEstadoComprobante,
  ESTADOS_COMPROBANTE,
} from "@/lib/comprobantes/estado";

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
 *   resumen: { cantidad: number, importe_total: number, importe_pagado: number, saldo_pendiente: number } | null,
 *   proveedores: Array<{ id_proveedor: string, nombre_proveedor: string }>,
 *   tipos: Array<{ id_tipo_comprobante: string, nombre_tipo_comprobante: string, letra: string | null }>,
 *   filtros: { proveedor: string, estado: string, desde: string, hasta: string, tipo: string },
 * }} props
 */
export function ComprobantesTable({
  comprobantes,
  resumen,
  proveedores,
  tipos,
  filtros,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [busqueda, setBusqueda] = useState("");

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return comprobantes;
    return comprobantes.filter(
      (c) =>
        String(c.nombre_proveedor ?? "")
          .toLowerCase()
          .includes(q) ||
        String(c.numero_formateado ?? "")
          .toLowerCase()
          .includes(q) ||
        String(c.nombre_tipo_comprobante ?? "")
          .toLowerCase()
          .includes(q)
    );
  }, [comprobantes, busqueda]);

  function setParam(key, value) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function limpiarFiltros() {
    router.push(pathname);
  }

  const hayFiltros =
    filtros.proveedor ||
    filtros.estado ||
    filtros.desde ||
    filtros.hasta ||
    filtros.tipo;

  function anular(c) {
    const ok = window.confirm(
      `¿Anular el comprobante ${c.nombre_tipo_comprobante} ${c.numero_formateado} de ${c.nombre_proveedor}? Esta acción es una baja lógica.`
    );
    if (!ok) return;

    startTransition(async () => {
      const result = await anularComprobante(c.id_comprobante);
      if (!result.ok) {
        const ui = mapErrorComprobante(result);
        window.alert(ui.message);
        if (ui.reload) router.refresh();
        return;
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
              {ESTADOS_COMPROBANTE.map((estado) => (
                <option key={estado} value={estado}>
                  {estado}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-palacio-muted">
            Tipo
            <select
              value={filtros.tipo}
              onChange={(e) => setParam("tipo", e.target.value)}
              className="palacio-input max-w-xs"
            >
              <option value="">Todos</option>
              {tipos.map((t) => (
                <option key={t.id_tipo_comprobante} value={t.id_tipo_comprobante}>
                  {t.nombre_tipo_comprobante}
                  {t.letra ? ` (${t.letra})` : ""}
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
          {hayFiltros ? (
            <button
              type="button"
              onClick={limpiarFiltros}
              className="palacio-action-btn"
            >
              Limpiar filtros
            </button>
          ) : null}
        </div>
        <Link
          href="/compras/comprobantes/nuevo"
          className="palacio-btn-primary inline-flex px-4 py-2.5 text-sm"
        >
          Registrar comprobante
        </Link>
      </div>

      {resumen ? (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ResumenItem label="Comprobantes" valor={String(resumen.cantidad)} />
          <ResumenItem
            label="Importe total"
            valor={monedaFmt.format(resumen.importe_total)}
          />
          <ResumenItem
            label="Pagado"
            valor={monedaFmt.format(resumen.importe_pagado)}
          />
          <ResumenItem
            label="Saldo pendiente"
            valor={monedaFmt.format(resumen.saldo_pendiente)}
          />
        </div>
      ) : null}

      <div className="mb-4">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar en la página por proveedor, número o tipo"
          className="palacio-input max-w-sm"
        />
      </div>

      {filtrados.length === 0 ? (
        <div className="palacio-card px-6 py-12 text-center">
          <p className="text-sm text-palacio-muted">
            {comprobantes.length === 0
              ? "No hay comprobantes para el filtro aplicado."
              : "Ningún comprobante coincide con la búsqueda."}
          </p>
        </div>
      ) : (
        <div className="palacio-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Listado</h2>
            <span className="text-xs text-palacio-muted">
              {filtrados.length} comprobante{filtrados.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-palacio-border bg-zinc-50/80">
                  <Th>Proveedor</Th>
                  <Th>Tipo</Th>
                  <Th>Número</Th>
                  <Th>Fecha</Th>
                  <Th>Vencimiento</Th>
                  <Th className="text-right">Total</Th>
                  <Th className="text-right">Saldo</Th>
                  <Th className="text-center">Estado</Th>
                  <Th>Registrado por</Th>
                  <Th className="text-right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => (
                  <tr
                    key={c.id_comprobante}
                    className={[
                      "border-b border-palacio-border last:border-0",
                      c.anulado ? "opacity-60" : "",
                    ].join(" ")}
                  >
                    <td className="px-5 py-4 align-middle font-medium text-zinc-900">
                      {c.nombre_proveedor}
                    </td>
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
                        {c.estado ?? (c.anulado ? "Anulado" : "Pendiente")}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {c.creado_por_nombre ?? "—"}
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/compras/comprobantes/${c.id_comprobante}`}
                          className="palacio-action-btn"
                        >
                          Ver detalle
                        </Link>
                        <button
                          type="button"
                          disabled={pending || c.anulado}
                          onClick={() => anular(c)}
                          className="palacio-action-btn palacio-action-danger"
                        >
                          Anular
                        </button>
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
