"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { EliminarLoteButton } from "./EliminarLoteButton";

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

function formatFecha(valor, conHora = false) {
  if (!valor) return "—";
  const d = new Date(conHora ? valor : `${valor}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? "—"
    : (conHora ? fechaHoraFmt : fechaFmt).format(d);
}

/**
 * Historial de lotes recientes. Depósito escribe `?deposito=` (server).
 * Marca / categoría / rubro se filtran en cliente.
 *
 * @param {{
 *   filas: Array<{
 *     id_inventario_producto: string,
 *     id_producto: string,
 *     codigo_producto: string,
 *     nombre_completo: string,
 *     nombre_deposito: string,
 *     fecha_fabricacion: string | null,
 *     fecha_vencimiento: string | null,
 *     stock: string,
 *     fecha_registro: string,
 *     id_marca?: string | null,
 *     id_categoria?: string | null,
 *     id_rubro?: string | null,
 *   }>,
 *   depositos: Array<{ id_deposito: string, nombre_deposito: string }>,
 *   filtroDeposito: string,
 *   marcas: Array<{ id_marca: string, nombre_marca: string }>,
 *   categorias: Array<{ id_categoria: string, nombre_categoria: string }>,
 *   rubros: Array<{ id_rubro: string, nombre_rubro: string }>,
 * }} props
 */
export function LotesRecientesTable({
  filas,
  depositos,
  filtroDeposito,
  marcas,
  categorias,
  rubros,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filtroMarca, setFiltroMarca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroRubro, setFiltroRubro] = useState("");

  function onDepositoChange(valor) {
    const params = new URLSearchParams(searchParams);
    if (valor) params.set("deposito", valor);
    else params.delete("deposito");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const filtradas = useMemo(() => {
    return filas.filter((f) => {
      if (filtroMarca && f.id_marca !== filtroMarca) return false;
      if (filtroCategoria && f.id_categoria !== filtroCategoria) return false;
      if (filtroRubro && f.id_rubro !== filtroRubro) return false;
      return true;
    });
  }, [filas, filtroMarca, filtroCategoria, filtroRubro]);

  const hayFiltros = Boolean(
    filtroDeposito || filtroMarca || filtroCategoria || filtroRubro
  );

  return (
    <>
      <div className="palacio-card mb-4 flex flex-wrap items-end gap-3 p-4">
        <label className="flex flex-col gap-1.5 text-sm text-zinc-700">
          <span className="text-[11px] font-semibold tracking-wider text-palacio-muted uppercase">
            Depósito
          </span>
          <select
            value={filtroDeposito}
            onChange={(e) => onDepositoChange(e.target.value)}
            className="palacio-input min-w-48"
          >
            <option value="">Todos</option>
            {depositos.map((d) => (
              <option key={d.id_deposito} value={d.id_deposito}>
                {d.nombre_deposito}
              </option>
            ))}
          </select>
        </label>
        <select
          value={filtroMarca}
          onChange={(e) => setFiltroMarca(e.target.value)}
          className="palacio-input max-w-[12rem]"
          aria-label="Filtrar por marca"
        >
          <option value="">Todas las marcas</option>
          {marcas.map((m) => (
            <option key={m.id_marca} value={m.id_marca}>
              {m.nombre_marca}
            </option>
          ))}
        </select>
        <select
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
          className="palacio-input max-w-[12rem]"
          aria-label="Filtrar por categoría"
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.id_categoria} value={c.id_categoria}>
              {c.nombre_categoria}
            </option>
          ))}
        </select>
        <select
          value={filtroRubro}
          onChange={(e) => setFiltroRubro(e.target.value)}
          className="palacio-input max-w-[12rem]"
          aria-label="Filtrar por rubro"
        >
          <option value="">Todos los rubros</option>
          {rubros.map((r) => (
            <option key={r.id_rubro} value={r.id_rubro}>
              {r.nombre_rubro}
            </option>
          ))}
        </select>
      </div>

      {filtradas.length === 0 ? (
        <div className="palacio-card px-6 py-12 text-center">
          <p className="text-sm text-palacio-muted">
            {filas.length === 0
              ? filtroDeposito
                ? "No hay lotes registrados en este depósito."
                : "No hay lotes registrados todavía."
              : hayFiltros
                ? "Ningún lote coincide con los filtros."
                : "No hay lotes registrados todavía."}
          </p>
        </div>
      ) : (
        <div className="palacio-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Historial</h2>
            <span className="text-xs text-palacio-muted">
              {filtradas.length} lote{filtradas.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-palacio-border bg-zinc-50/80">
                  <Th>Código</Th>
                  <Th>Producto</Th>
                  <Th>Depósito</Th>
                  <Th>Elaboración</Th>
                  <Th>Vencimiento</Th>
                  <Th className="text-right">Stock</Th>
                  <Th>Registrado</Th>
                  <Th className="text-right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((f) => (
                  <tr
                    key={f.id_inventario_producto}
                    className="border-b border-palacio-border last:border-0"
                  >
                    <td className="px-5 py-4 align-middle">
                      <span className="font-mono text-xs text-zinc-700">
                        {f.codigo_producto}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-middle font-medium text-zinc-900">
                      {f.nombre_completo}
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {f.nombre_deposito}
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {formatFecha(f.fecha_fabricacion)}
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {formatFecha(f.fecha_vencimiento)}
                    </td>
                    <td className="px-5 py-4 text-right align-middle tabular-nums text-zinc-900">
                      {f.stock}
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {formatFecha(f.fecha_registro, true)}
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <div className="flex justify-end">
                        <EliminarLoteButton
                          idLote={f.id_lote}
                          nombreCompleto={f.nombre_completo}
                        />
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
