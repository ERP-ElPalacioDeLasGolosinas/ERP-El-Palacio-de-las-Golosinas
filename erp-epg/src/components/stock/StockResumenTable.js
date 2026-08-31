"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

const numFmt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

/**
 * Listado principal de stock: una fila por producto (total sumado entre
 * depósitos). El buscador escribe `?q=` en la URL y el server vuelve a llamar
 * `fn_stock_resumen_por_producto(p_busqueda)`. Marca / categoría / rubro se
 * filtran en cliente (mismos selects que Productos).
 *
 * @param {{
 *   filas: Array<{
 *     id_producto: string,
 *     codigo_producto: string,
 *     nombre_completo: string,
 *     nombre_marca: string,
 *     stock_total: number,
 *     cantidad_depositos: number,
 *     id_marca?: string | null,
 *     id_categoria?: string | null,
 *     id_rubro?: string | null,
 *   }>,
 *   busquedaInicial: string,
 *   marcas: Array<{ id_marca: string, nombre_marca: string }>,
 *   categorias: Array<{ id_categoria: string, nombre_categoria: string }>,
 *   rubros: Array<{ id_rubro: string, nombre_rubro: string }>,
 * }} props
 */
export function StockResumenTable({
  filas,
  busquedaInicial,
  marcas,
  categorias,
  rubros,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [busqueda, setBusqueda] = useState(busquedaInicial ?? "");
  const [filtroMarca, setFiltroMarca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroRubro, setFiltroRubro] = useState("");
  const primeraRef = useRef(true);

  useEffect(() => {
    if (primeraRef.current) {
      primeraRef.current = false;
      return;
    }
    const actual = (searchParams.get("q") ?? "").trim();
    const nueva = busqueda.trim();
    if (actual === nueva) return;

    const t = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (nueva) params.set("q", nueva);
      else params.delete("q");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }, 300);
    return () => clearTimeout(t);
  }, [busqueda, pathname, router, searchParams]);

  const filtradas = useMemo(() => {
    return filas.filter((f) => {
      if (filtroMarca && f.id_marca !== filtroMarca) return false;
      if (filtroCategoria && f.id_categoria !== filtroCategoria) return false;
      if (filtroRubro && f.id_rubro !== filtroRubro) return false;
      return true;
    });
  }, [filas, filtroMarca, filtroCategoria, filtroRubro]);

  const hayFiltrosCatalogo = Boolean(
    filtroMarca || filtroCategoria || filtroRubro
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por código, producto o marca"
          className="palacio-input max-w-sm"
        />
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
              ? busqueda.trim()
                ? "Ningún producto coincide con la búsqueda."
                : "No hay stock para mostrar."
              : hayFiltrosCatalogo
                ? "Ningún producto coincide con los filtros."
                : "No hay stock para mostrar."}
          </p>
        </div>
      ) : (
        <div className="palacio-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Listado</h2>
            <span className="text-xs text-palacio-muted">
              {filtradas.length} producto{filtradas.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-palacio-border bg-zinc-50/80">
                  <Th>Código</Th>
                  <Th>Producto</Th>
                  <Th className="text-right">Stock total</Th>
                  <Th>Depósitos</Th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((f) => (
                  <tr
                    key={f.id_producto}
                    onClick={() =>
                      router.push(`/inventario/stock/${f.id_producto}`)
                    }
                    className="cursor-pointer border-b border-palacio-border transition-colors last:border-0 hover:bg-zinc-50"
                  >
                    <td className="px-5 py-4 align-middle">
                      <span className="font-mono text-xs text-zinc-700">
                        {f.codigo_producto}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <span className="font-medium text-zinc-900">
                        {f.nombre_completo}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right align-middle tabular-nums text-zinc-900">
                      {numFmt.format(Number(f.stock_total ?? 0))}
                      <span className="ml-1 text-xs text-palacio-muted">
                        unds
                      </span>
                    </td>
                    <td className="px-5 py-4 align-middle">
                      {Number(f.cantidad_depositos ?? 0) > 1 ? (
                        <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
                          en {f.cantidad_depositos} depósitos
                        </span>
                      ) : (
                        <span className="text-xs text-palacio-muted">
                          1 depósito
                        </span>
                      )}
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
