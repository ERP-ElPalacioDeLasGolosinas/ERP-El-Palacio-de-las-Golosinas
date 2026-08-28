"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

const fechaFmt = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const fechaHoraFmt = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const numFmt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

function formatFecha(valor, conHora = false) {
  if (!valor) return "—";
  const d = new Date(conHora ? valor : `${valor}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? "—"
    : (conHora ? fechaHoraFmt : fechaFmt).format(d);
}

function formatValor(valor) {
  const n = Number(valor ?? 0);
  const signo = n >= 0 ? "+" : "−";
  return `${signo}${numFmt.format(Math.abs(n))}`;
}

/**
 * @param {{
 *   movimientos: Array<Record<string, any>>,
 *   productos: Array<{ id_producto: string, nombre_completo: string }>,
 *   depositos: Array<{ id_deposito: string, nombre_deposito: string }>,
 *   tipos: Array<{ id_tipo_movimiento: string, nombre: string }>,
 *   filtros: { producto: string, deposito: string, tipo: string, desde: string, hasta: string },
 * }} props
 */
export function MovimientosTable({
  movimientos,
  productos,
  depositos,
  tipos,
  filtros,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [form, setForm] = useState({
    producto: filtros.producto,
    deposito: filtros.deposito,
    tipo: filtros.tipo,
    desde: filtros.desde,
    hasta: filtros.hasta,
  });

  const hayFiltros = useMemo(
    () => Object.values(filtros).some((v) => v),
    [filtros]
  );

  function aplicar(e) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    const map = {
      producto: form.producto,
      deposito: form.deposito,
      tipo: form.tipo,
      desde: form.desde,
      hasta: form.hasta,
    };
    for (const [k, v] of Object.entries(map)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function limpiar() {
    setForm({ producto: "", deposito: "", tipo: "", desde: "", hasta: "" });
    router.push(pathname);
  }

  function set(campo, valor) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  }

  return (
    <>
      <form
        onSubmit={aplicar}
        className="palacio-card mb-4 flex flex-wrap items-end gap-3 p-4"
      >
        <Filtro label="Producto">
          <select
            value={form.producto}
            onChange={(e) => set("producto", e.target.value)}
            className="palacio-input min-w-48"
          >
            <option value="">Todos</option>
            {productos.map((p) => (
              <option key={p.id_producto} value={p.id_producto}>
                {p.nombre_completo}
              </option>
            ))}
          </select>
        </Filtro>
        <Filtro label="Depósito">
          <select
            value={form.deposito}
            onChange={(e) => set("deposito", e.target.value)}
            className="palacio-input min-w-40"
          >
            <option value="">Todos</option>
            {depositos.map((d) => (
              <option key={d.id_deposito} value={d.id_deposito}>
                {d.nombre_deposito}
              </option>
            ))}
          </select>
        </Filtro>
        <Filtro label="Concepto">
          <select
            value={form.tipo}
            onChange={(e) => set("tipo", e.target.value)}
            className="palacio-input min-w-44"
          >
            <option value="">Todos</option>
            {tipos.map((t) => (
              <option key={t.id_tipo_movimiento} value={t.id_tipo_movimiento}>
                {t.nombre}
              </option>
            ))}
          </select>
        </Filtro>
        <Filtro label="Desde">
          <input
            type="date"
            value={form.desde}
            onChange={(e) => set("desde", e.target.value)}
            className="palacio-input"
          />
        </Filtro>
        <Filtro label="Hasta">
          <input
            type="date"
            value={form.hasta}
            onChange={(e) => set("hasta", e.target.value)}
            className="palacio-input"
          />
        </Filtro>
        <div className="flex gap-2">
          <button
            type="submit"
            className="palacio-btn-primary px-4 py-2.5 text-sm"
          >
            Filtrar
          </button>
          {hayFiltros ? (
            <button
              type="button"
              onClick={limpiar}
              className="palacio-btn-secondary px-4 py-2.5 text-sm"
            >
              Limpiar
            </button>
          ) : null}
        </div>
      </form>

      {movimientos.length === 0 ? (
        <div className="palacio-card px-6 py-12 text-center">
          <p className="text-sm text-palacio-muted">
            {hayFiltros
              ? "No hay movimientos que coincidan con los filtros."
              : "No hay movimientos registrados."}
          </p>
        </div>
      ) : (
        <div className="palacio-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Historial</h2>
            <span className="text-xs text-palacio-muted">
              {movimientos.length} movimiento
              {movimientos.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-palacio-border bg-zinc-50/80">
                  <Th>Concepto</Th>
                  <Th>Fecha</Th>
                  <Th className="text-right">Valor</Th>
                  <Th>Producto</Th>
                  <Th>Depósito</Th>
                  <Th>Doc. ligado</Th>
                  <Th>Creado</Th>
                  <Th>Creado por</Th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((m) => {
                  const positivo = Number(m.valor ?? 0) >= 0;
                  return (
                    <tr
                      key={m.id_movimiento}
                      className="border-b border-palacio-border last:border-0"
                    >
                      <td className="px-5 py-4 align-middle">
                        <p className="font-medium text-zinc-900">
                          {m.tipo_movimiento_nombre}
                        </p>
                        {m.id_movimiento_referencia ? (
                          <p className="text-xs text-palacio-muted">
                            Corrige mov. del{" "}
                            {formatFecha(m.referencia_fecha_movimiento)}
                            {m.referencia_tipo_movimiento_nombre
                              ? ` — ${m.referencia_tipo_movimiento_nombre}`
                              : ""}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 align-middle text-palacio-muted">
                        {formatFecha(m.fecha_movimiento)}
                      </td>
                      <td
                        className={[
                          "px-5 py-4 text-right align-middle font-semibold tabular-nums",
                          positivo ? "text-green-600" : "text-red-600",
                        ].join(" ")}
                      >
                        {formatValor(m.valor)}
                      </td>
                      <td className="px-5 py-4 align-middle text-zinc-700">
                        {m.producto_nombre_completo ?? m.nombre_producto}
                      </td>
                      <td className="px-5 py-4 align-middle text-palacio-muted">
                        {m.nombre_deposito}
                      </td>
                      <td className="px-5 py-4 align-middle text-palacio-muted">
                        {m.documento_ligado ?? "—"}
                      </td>
                      <td className="px-5 py-4 align-middle text-palacio-muted">
                        {formatFecha(m.creado, true)}
                      </td>
                      <td className="px-5 py-4 align-middle text-palacio-muted">
                        {m.creado_por_nombre ??
                          (m.creado_por
                            ? `${m.creado_por.slice(0, 8)}…`
                            : "—")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-palacio-muted">
        Los movimientos son inmutables: para corregir un error, registrá un{" "}
        <Link
          href="/inventario/movimientos/nuevo"
          className="font-medium text-palacio-red underline underline-offset-2"
        >
          movimiento de ajuste
        </Link>{" "}
        que lo compense.
      </p>
    </>
  );
}

function Filtro({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm text-zinc-700">
      <span className="text-[11px] font-semibold tracking-wider text-palacio-muted uppercase">
        {label}
      </span>
      {children}
    </label>
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
