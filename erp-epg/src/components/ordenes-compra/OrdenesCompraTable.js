"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cancelarOrden } from "@/lib/ordenes-compra/actions";
import { ESTADOS_ORDEN, badgeEstadoOrden } from "@/lib/ordenes-compra/estado";
import { mapErrorOrden } from "@/lib/ordenes-compra/errores";

const fechaFmt = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatFecha(valor) {
  if (!valor) return "—";
  const d = new Date(`${valor}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "—" : fechaFmt.format(d);
}

/**
 * Mismo armado que el historial de comprobantes: filtros que aplican al
 * cambiar, buscador de la página y listado con acciones.
 *
 * @param {{
 *   ordenes: Array<Record<string, any>>,
 *   proveedores: Array<{ id_proveedor: string, nombre_proveedor: string }>,
 *   filtros: { proveedor: string, estado: string, desde: string, hasta: string },
 * }} props
 */
export function OrdenesCompraTable({ ordenes, proveedores, filtros }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [busqueda, setBusqueda] = useState("");

  function setParam(key, value) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const q = busqueda.trim().toLowerCase();
  const filtradas = q
    ? ordenes.filter((o) => {
        const texto = `${o.numero_formateado ?? ""} ${o.nombre_proveedor ?? ""} ${o.estado ?? ""} ${o.creado_por_nombre ?? ""}`;
        return texto.toLowerCase().includes(q);
      })
    : ordenes;

  const hayFiltros = Boolean(
    filtros.proveedor || filtros.estado || filtros.desde || filtros.hasta
  );

  const resumen = {
    cantidad: ordenes.length,
    pendientes: ordenes.filter((o) => o.estado === "Pendiente").length,
    facturadas: ordenes.filter((o) => o.estado === "Facturada").length,
    recibidas: ordenes.filter(
      (o) => o.estado === "Recibida parcial" || o.estado === "Recibida total"
    ).length,
    canceladas: ordenes.filter((o) => o.estado === "Cancelada").length,
  };

  function cancelar(orden) {
    const ok = window.confirm(
      `¿Cancelar la orden ${orden.numero_formateado} de ${orden.nombre_proveedor}? No se van a poder recibir mercadería ni cargar facturas contra ella.`
    );
    if (!ok) return;

    startTransition(async () => {
      const result = await cancelarOrden(orden.id_orden_compra);
      if (!result.ok) {
        window.alert(mapErrorOrden(result).message);
        router.refresh();
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
              {ESTADOS_ORDEN.map((estado) => (
                <option key={estado} value={estado}>
                  {estado}
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
              onClick={() => router.push(pathname)}
              className="palacio-action-btn"
            >
              Limpiar filtros
            </button>
          ) : null}
        </div>
        <Link
          href="/compras/ordenes/nuevo"
          className="palacio-btn-primary inline-flex px-4 py-2.5 text-sm"
        >
          Registrar orden
        </Link>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <ResumenItem label="Órdenes" valor={String(resumen.cantidad)} />
        <ResumenItem label="Pendientes" valor={String(resumen.pendientes)} />
        <ResumenItem label="Facturadas" valor={String(resumen.facturadas)} />
        <ResumenItem label="Recibidas" valor={String(resumen.recibidas)} />
        <ResumenItem label="Canceladas" valor={String(resumen.canceladas)} />
      </div>

      <div className="mb-4">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar en la página por número, proveedor o estado"
          className="palacio-input max-w-sm"
        />
      </div>

      {filtradas.length === 0 ? (
        <div className="palacio-card px-6 py-12 text-center">
          <p className="text-sm text-palacio-muted">
            {ordenes.length === 0
              ? "No hay órdenes para el filtro aplicado."
              : "Ninguna orden coincide con la búsqueda."}
          </p>
        </div>
      ) : (
        <div className="palacio-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Listado</h2>
            <span className="text-xs text-palacio-muted">
              {filtradas.length} orden{filtradas.length === 1 ? "" : "es"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-palacio-border bg-zinc-50/80">
                  <Th>Proveedor</Th>
                  <Th>Número</Th>
                  <Th>Emisión</Th>
                  <Th className="text-right">Artículos</Th>
                  <Th className="text-center">Estado</Th>
                  <Th>Registrado por</Th>
                  <Th className="text-right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((o) => (
                  <tr
                    key={o.id_orden_compra}
                    className="border-b border-palacio-border last:border-0"
                  >
                    <td className="px-5 py-4 align-middle font-medium text-zinc-900">
                      {o.nombre_proveedor}
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <span className="font-mono text-xs text-zinc-700">
                        {o.numero_formateado}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {formatFecha(o.fecha_emision)}
                    </td>
                    <td className="px-5 py-4 text-right align-middle tabular-nums">
                      {o.cantidad_articulos}
                    </td>
                    <td className="px-5 py-4 text-center align-middle">
                      <span className={badgeEstadoOrden(o.estado)}>{o.estado}</span>
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {o.creado_por_nombre ?? "—"}
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/compras/ordenes/${o.id_orden_compra}`}
                          className="palacio-action-btn"
                        >
                          Ver detalle
                        </Link>
                        <button
                          type="button"
                          disabled={pending || o.estado !== "Pendiente"}
                          onClick={() => cancelar(o)}
                          className="palacio-action-btn palacio-action-danger"
                        >
                          Cancelar
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
