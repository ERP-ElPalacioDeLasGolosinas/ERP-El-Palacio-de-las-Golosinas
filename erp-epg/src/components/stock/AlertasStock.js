"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const numFmt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 });

/**
 * @param {{
 *   alertas: Array<Record<string, unknown>>,
 *   depositos: Array<{ id_deposito: string, nombre_deposito: string }>,
 *   deposito: string,
 * }} props
 */
export function AlertasStock({ alertas, depositos, deposito }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [busqueda, setBusqueda] = useState("");

  function setDeposito(valor) {
    const params = new URLSearchParams(searchParams);
    if (valor) params.set("deposito", valor);
    else params.delete("deposito");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const q = busqueda.trim().toLowerCase();
  const visibles = q
    ? alertas.filter((a) => {
        const texto = `${a.nombre_completo ?? ""} ${a.codigo_producto ?? ""} ${a.nombre_deposito ?? ""}`;
        return texto.toLowerCase().includes(q);
      })
    : alertas;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-palacio-muted">
          Depósito
          <select
            value={deposito}
            onChange={(e) => setDeposito(e.target.value)}
            className="palacio-input min-w-52"
          >
            <option value="">Todos</option>
            {depositos.map((d) => (
              <option key={d.id_deposito} value={d.id_deposito}>
                {d.nombre_deposito}
              </option>
            ))}
          </select>
        </label>
        {deposito ? (
          <button
            type="button"
            onClick={() => setDeposito("")}
            className="palacio-action-btn"
          >
            Limpiar filtros
          </button>
        ) : null}
      </div>

      <div className="mb-4">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar en la página por artículo, código o depósito"
          className="palacio-input max-w-sm"
        />
      </div>

      {visibles.length === 0 ? (
        <div className="palacio-card px-6 py-12 text-center">
          <p className="text-sm text-palacio-muted">
            {alertas.length === 0
              ? "No hay artículos en o por debajo del stock mínimo."
              : "Ningún artículo coincide con la búsqueda."}
          </p>
        </div>
      ) : (
        <div className="palacio-card overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-palacio-border bg-zinc-50/80">
                {["Artículo", "Depósito", "Stock actual", "Mínimo", "Diferencia"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-[11px] font-semibold tracking-wider text-palacio-muted uppercase"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibles.map((a) => (
                <tr
                  key={`${a.id_producto}-${a.id_deposito}`}
                  className="border-b border-palacio-border last:border-0"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/inventario/stock/${a.id_producto}`}
                      className="font-medium text-zinc-900 underline decoration-transparent hover:text-palacio-red hover:decoration-current"
                    >
                      {a.nombre_completo}
                    </Link>
                    {a.codigo_producto ? (
                      <p className="text-xs text-palacio-muted">{a.codigo_producto}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{a.nombre_deposito}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {numFmt.format(Number(a.stock_actual))}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {numFmt.format(Number(a.stock_minimo))}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-red-700">
                    {numFmt.format(Number(a.diferencia))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
