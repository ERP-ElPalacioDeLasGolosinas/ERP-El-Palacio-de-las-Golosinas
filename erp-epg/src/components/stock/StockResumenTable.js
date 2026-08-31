"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

const numFmt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

/**
 * Listado principal de stock: una fila por producto (total sumado entre
 * depósitos). El buscador escribe `?q=` en la URL y el server vuelve a llamar
 * `fn_stock_resumen_por_producto(p_busqueda)`. Cada fila navega al detalle del
 * producto.
 *
 * @param {{
 *   filas: Array<{
 *     id_producto: string,
 *     codigo_producto: string,
 *     nombre_completo: string,
 *     nombre_marca: string,
 *     stock_total: number,
 *     cantidad_depositos: number,
 *   }>,
 *   busquedaInicial: string,
 * }} props
 */
export function StockResumenTable({ filas, busquedaInicial }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [busqueda, setBusqueda] = useState(busquedaInicial ?? "");
  const primeraRef = useRef(true);

  // Debounce: propaga la búsqueda a la URL (y con eso al RPC) sin disparar en
  // el primer render ni cuando el valor no cambió respecto de la URL.
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

  return (
    <>
      <div className="mb-4">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por código, producto o marca"
          className="palacio-input max-w-sm"
        />
      </div>

      {filas.length === 0 ? (
        <div className="palacio-card px-6 py-12 text-center">
          <p className="text-sm text-palacio-muted">
            {busqueda.trim()
              ? "Ningún producto coincide con la búsqueda."
              : "No hay stock para mostrar."}
          </p>
        </div>
      ) : (
        <div className="palacio-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Listado</h2>
            <span className="text-xs text-palacio-muted">
              {filas.length} producto{filas.length === 1 ? "" : "s"}
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
                {filas.map((f) => (
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
