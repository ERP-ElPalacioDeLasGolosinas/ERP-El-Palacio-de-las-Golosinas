"use client";

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

function formatFecha(valor, conHora = false) {
  if (!valor) return "—";
  const d = new Date(conHora ? valor : `${valor}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? "—"
    : (conHora ? fechaHoraFmt : fechaFmt).format(d);
}

/**
 * Historial de lotes recientes. El filtro de Depósito es opcional (sin depósito
 * se listan los de todos) y escribe `?deposito=` en la URL para que el server
 * re-llame `fn_inventario_producto_listar_recientes`.
 *
 * @param {{
 *   filas: Array<{
 *     id_inventario_producto: string,
 *     codigo_producto: string,
 *     nombre_completo: string,
 *     nombre_deposito: string,
 *     fecha_fabricacion: string | null,
 *     fecha_vencimiento: string | null,
 *     stock: string,
 *     fecha_registro: string,
 *   }>,
 *   depositos: Array<{ id_deposito: string, nombre_deposito: string }>,
 *   filtroDeposito: string,
 * }} props
 */
export function LotesRecientesTable({ filas, depositos, filtroDeposito }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onDepositoChange(valor) {
    const params = new URLSearchParams(searchParams);
    if (valor) params.set("deposito", valor);
    else params.delete("deposito");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <>
      <form className="palacio-card mb-4 flex flex-wrap items-end gap-3 p-4">
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
      </form>

      {filas.length === 0 ? (
        <div className="palacio-card px-6 py-12 text-center">
          <p className="text-sm text-palacio-muted">
            {filtroDeposito
              ? "No hay lotes registrados en este depósito."
              : "No hay lotes registrados todavía."}
          </p>
        </div>
      ) : (
        <div className="palacio-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Historial</h2>
            <span className="text-xs text-palacio-muted">
              {filas.length} lote{filas.length === 1 ? "" : "s"}
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
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
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
