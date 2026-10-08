import Link from "next/link";
import { hora, moneda } from "@/components/cajas/formato";

/**
 * Movimientos de la caja (más recientes primero). Los generados por una venta
 * enlazan al comprobante.
 *
 * @param {{ movimientos: Array<Record<string, any>> }} props
 */
export function MovimientosCajaTable({ movimientos }) {
  return (
    <div className="palacio-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
        <h2 className="text-sm font-semibold text-zinc-900">Movimientos</h2>
        <span className="text-xs text-palacio-muted">
          {movimientos.length} movimiento{movimientos.length === 1 ? "" : "s"}
        </span>
      </div>
      {movimientos.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-palacio-muted">Todavía no hay movimientos en esta caja.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-palacio-border bg-zinc-50/80">
                <Th>Hora</Th>
                <Th>Tipo</Th>
                <Th>Medio</Th>
                <Th>Motivo</Th>
                <Th>Referencia</Th>
                <Th className="text-right">Importe</Th>
                <Th>Usuario</Th>
              </tr>
            </thead>
            <tbody>
              {movimientos.map((m) => {
                const ingreso = m.tipo === "Ingreso";
                return (
                  <tr key={m.id_movimiento_caja} className="border-b border-palacio-border last:border-0">
                    <td className="px-5 py-3 align-middle text-palacio-muted">{hora(m.creado)}</td>
                    <td className="px-5 py-3 align-middle">
                      <span className={ingreso ? "palacio-badge-activo" : "palacio-badge-lleno"}>{m.tipo}</span>
                    </td>
                    <td className="px-5 py-3 align-middle text-zinc-800">{m.nombre_medio_pago}</td>
                    <td className="max-w-xs truncate px-5 py-3 align-middle text-zinc-800" title={m.motivo}>
                      {m.id_comprobante ? (
                        <Link
                          href={`/ventas/ordenes/${m.id_comprobante}`}
                          className="hover:text-palacio-red hover:underline"
                        >
                          {m.comprobante ?? m.motivo}
                        </Link>
                      ) : (
                        m.motivo
                      )}
                    </td>
                    <td className="px-5 py-3 align-middle font-mono text-xs text-palacio-muted">
                      {m.referencia ?? "—"}
                    </td>
                    <td
                      className={`px-5 py-3 text-right align-middle font-medium ${ingreso ? "text-emerald-700" : "text-red-700"}`}
                    >
                      {ingreso ? "+" : "−"} {moneda(m.importe)}
                    </td>
                    <td className="px-5 py-3 align-middle text-palacio-muted">{m.creado_por_nombre}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children, className = "" }) {
  return (
    <th className={`px-5 py-3 text-[11px] font-semibold tracking-wider text-palacio-muted uppercase ${className}`}>
      {children}
    </th>
  );
}
