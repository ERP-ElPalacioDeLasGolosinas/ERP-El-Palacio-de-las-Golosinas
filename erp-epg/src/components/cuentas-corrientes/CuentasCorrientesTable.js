"use client";

import Link from "next/link";
import { useState } from "react";
import { posicionCuenta } from "@/lib/cuentas-corrientes/posicion";

const monedaFmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

/**
 * @param {{
 *   lado: "proveedor" | "cliente",
 *   basePath: string,
 *   cuentas: Array<{ id: string, nombre: string, activo: boolean, saldo: number, cantidad_movimientos: number }>,
 * }} props
 */
export function CuentasCorrientesTable({ lado, basePath, cuentas }) {
  const [busqueda, setBusqueda] = useState("");
  const [posicion, setPosicion] = useState("");
  const q = busqueda.trim().toLowerCase();
  const filas = cuentas.filter((c) => {
    if (q && !c.nombre.toLowerCase().includes(q)) return false;
    if (posicion && posicionCuenta(lado, c.saldo).clave !== posicion) return false;
    return true;
  });

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-palacio-muted">
          Buscar
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={lado === "proveedor" ? "Proveedor…" : "Cliente…"}
            className="palacio-input w-64"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-palacio-muted">
          Posición
          <select
            value={posicion}
            onChange={(e) => setPosicion(e.target.value)}
            className="palacio-input"
          >
            <option value="">Todas</option>
            <option value="favor">A favor</option>
            <option value="contra">En contra</option>
            <option value="aldia">Al día</option>
          </select>
        </label>
      </div>

      <div className="palacio-card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-palacio-border bg-zinc-50 text-xs uppercase tracking-wide text-palacio-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{lado === "proveedor" ? "Proveedor" : "Cliente"}</th>
              <th className="px-4 py-3 font-medium">Posición</th>
              <th className="px-4 py-3 text-right font-medium">Saldo</th>
              <th className="px-4 py-3 text-right font-medium">Movimientos</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-palacio-border">
            {filas.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-palacio-muted">
                  No hay cuentas para ese filtro.
                </td>
              </tr>
            ) : (
              filas.map((c) => {
                const pos = posicionCuenta(lado, c.saldo);
                return (
                  <tr key={c.id}>
                    <td className="px-4 py-3 text-zinc-900">
                      {c.nombre}
                      {!c.activo ? (
                        <span className="palacio-badge-inactivo ml-2">Inactivo</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className={pos.badge}>{pos.label}</span>
                      <span className="ml-2 text-xs text-palacio-muted">{pos.detalle}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-zinc-900">
                      {monedaFmt.format(Math.abs(Number(c.saldo) || 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-700">{c.cantidad_movimientos}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`${basePath}/${c.id}`} className="palacio-action-btn palacio-action-primary">
                        Ver historial
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
