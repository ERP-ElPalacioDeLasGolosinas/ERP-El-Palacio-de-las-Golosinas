"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

const numFmt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

/**
 * @param {{
 *   filas: Array<{
 *     id_stock: string,
 *     codigo_producto: string,
 *     producto: string,
 *     cantidad: number,
 *     nombre_deposito: string,
 *     unidad_medida: string,
 *   }>,
 *   productos: Array<{ id_producto: string, nombre_completo: string }>,
 *   depositos: Array<{ id_deposito: string, nombre_deposito: string }>,
 *   filtros: { producto: string, deposito: string },
 * }} props
 */
export function StockTable({ filas, productos, depositos, filtros }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [form, setForm] = useState({
    producto: filtros.producto,
    deposito: filtros.deposito,
  });
  const [busqueda, setBusqueda] = useState("");

  const hayFiltros = useMemo(
    () => Boolean(filtros.producto || filtros.deposito),
    [filtros]
  );

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return filas;
    return filas.filter(
      (f) =>
        f.codigo_producto?.toLowerCase().includes(q) ||
        f.producto?.toLowerCase().includes(q) ||
        f.nombre_deposito?.toLowerCase().includes(q)
    );
  }, [filas, busqueda]);

  function set(campo, valor) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  }

  function aplicar(e) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (form.producto) params.set("producto", form.producto);
    else params.delete("producto");
    if (form.deposito) params.set("deposito", form.deposito);
    else params.delete("deposito");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function limpiar() {
    setForm({ producto: "", deposito: "" });
    router.push(pathname);
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

      <div className="mb-4">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por código, producto o depósito"
          className="palacio-input max-w-sm"
        />
      </div>

      {visibles.length === 0 ? (
        <div className="palacio-card px-6 py-12 text-center">
          <p className="text-sm text-palacio-muted">
            {filas.length === 0
              ? hayFiltros
                ? "No hay stock que coincida con los filtros."
                : "No hay stock para mostrar."
              : "Ningún registro coincide con la búsqueda."}
          </p>
        </div>
      ) : (
        <div className="palacio-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Listado</h2>
            <span className="text-xs text-palacio-muted">
              {visibles.length} registro{visibles.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-palacio-border bg-zinc-50/80">
                  <Th>Código</Th>
                  <Th>Producto</Th>
                  <Th className="text-right">Stock</Th>
                  <Th>Depósito</Th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((f) => (
                  <tr
                    key={f.id_stock}
                    className="border-b border-palacio-border last:border-0"
                  >
                    <td className="px-5 py-4 align-middle">
                      <span className="font-mono text-xs text-zinc-700">
                        {f.codigo_producto}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <span className="font-medium text-zinc-900">
                        {f.producto}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right align-middle tabular-nums text-zinc-900">
                      {numFmt.format(Number(f.cantidad ?? 0))}
                      <span className="ml-1 text-xs text-palacio-muted">
                        unds
                      </span>
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {f.nombre_deposito}
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
