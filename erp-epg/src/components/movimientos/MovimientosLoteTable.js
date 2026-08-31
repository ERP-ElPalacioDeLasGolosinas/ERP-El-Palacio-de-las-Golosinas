"use client";

const numFmt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

/**
 * @param {{
 *   items: Array<{
 *     clientId: string,
 *     esTransferencia: boolean,
 *     nombreConcepto: string,
 *     nombreDeposito: string,
 *     nombreDepositoDestino?: string | null,
 *     nombreProducto: string,
 *     cantidad: number,
 *     remito: string,
 *     itemProblematico?: boolean,
 *   }>,
 *   onQuitar: (clientId: string) => void,
 *   onRegistrar: () => void,
 *   pending: boolean,
 *   errorServer: string | null,
 * }} props
 */
export function MovimientosLoteTable({
  items,
  onQuitar,
  onRegistrar,
  pending,
  errorServer,
}) {
  return (
    <div className="palacio-card mt-6 max-w-2xl overflow-hidden">
      <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
        <h2 className="text-sm font-semibold text-zinc-900">
          Movimientos a registrar
        </h2>
        <span className="text-xs text-palacio-muted">
          {items.length} ítem{items.length === 1 ? "" : "s"}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-palacio-muted">
          Todavía no agregaste ningún movimiento a la lista.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-palacio-border bg-zinc-50/80">
                <Th>Concepto</Th>
                <Th>Depósito</Th>
                <Th>Producto</Th>
                <Th className="text-right">Cantidad</Th>
                <Th>Remito</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.clientId}
                  className={[
                    "border-b border-palacio-border last:border-0",
                    item.itemProblematico ? "bg-red-50" : "",
                  ].join(" ")}
                >
                  <td className="px-5 py-3 align-middle font-medium text-zinc-900">
                    {item.nombreConcepto}
                  </td>
                  <td className="px-5 py-3 align-middle text-palacio-muted">
                    {item.esTransferencia
                      ? `${item.nombreDeposito} → ${item.nombreDepositoDestino}`
                      : item.nombreDeposito}
                  </td>
                  <td className="px-5 py-3 align-middle text-zinc-700">
                    {item.nombreProducto}
                  </td>
                  <td className="px-5 py-3 text-right align-middle tabular-nums text-zinc-900">
                    {numFmt.format(Number(item.cantidad ?? 0))}
                  </td>
                  <td className="px-5 py-3 align-middle text-palacio-muted">
                    {item.remito || "—"}
                  </td>
                  <td className="px-5 py-3 align-middle text-right">
                    <button
                      type="button"
                      onClick={() => onQuitar(item.clientId)}
                      disabled={pending}
                      className="text-xs font-medium text-palacio-red hover:underline disabled:opacity-50"
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {errorServer ? (
        <p className="mx-5 mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorServer}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 border-t border-palacio-border px-5 py-4">
        <button
          type="button"
          onClick={onRegistrar}
          disabled={pending || items.length === 0}
          className="palacio-btn-primary px-4 py-2.5 text-sm"
        >
          {pending ? "Registrando…" : "Registrar movimientos"}
        </button>
      </div>
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
