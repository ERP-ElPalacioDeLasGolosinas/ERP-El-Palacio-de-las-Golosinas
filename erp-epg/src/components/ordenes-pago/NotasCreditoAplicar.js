"use client";

const monedaFmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

/**
 * Lista de notas de crédito con saldo sin aplicar y el importe a usar
 * en la orden o en el pago.
 *
 * @param {{
 *   notas: Array<{
 *     id_comprobante: string,
 *     numero_formateado: string,
 *     importe_total?: number | string,
 *     descontado?: number | string,
 *     usado?: number | string,
 *     disponible: number | string,
 *   }>,
 *   uso: Record<string, string>,
 *   onChange: (idComprobante: string, valor: string) => void,
 *   onUsarMaximo: (nota: { id_comprobante: string }) => void,
 * }} props
 */
export function NotasCreditoAplicar({ notas, uso, onChange, onUsarMaximo }) {
  if (!notas?.length) return null;

  return (
    <div className="mx-4 mt-4 rounded-lg border border-palacio-border bg-zinc-50/70 p-4">
      <p className="text-sm font-medium text-zinc-900">Notas de crédito</p>
      <p className="mt-1 text-xs text-palacio-muted">
        Solo se puede usar lo que la nota no descontó de su factura y lo que
        todavía no se usó para pagar.
      </p>
      <div className="mt-3 space-y-3">
        {notas.map((n) => (
          <div
            key={n.id_comprobante}
            className="flex flex-wrap items-end justify-between gap-3"
          >
            <div>
              <p className="text-sm text-zinc-900">{n.numero_formateado}</p>
              <p className="text-xs text-palacio-muted">
                Original {monedaFmt.format(Number(n.importe_total) || 0)}
                {Number(n.descontado) > 0
                  ? ` · Ya descontó ${monedaFmt.format(Number(n.descontado) || 0)} de su factura`
                  : ""}
                {Number(n.usado) > 0
                  ? ` · Ya usados ${monedaFmt.format(Number(n.usado) || 0)}`
                  : ""}
              </p>
              <p className="text-xs text-zinc-800">
                Quedan {monedaFmt.format(Number(n.disponible) || 0)} para usar
              </p>
            </div>
            <div className="flex items-end gap-2">
              <label className="flex flex-col gap-1 text-xs font-medium text-palacio-muted">
                Importe a usar
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={uso[n.id_comprobante] ?? ""}
                  onChange={(e) => onChange(n.id_comprobante, e.target.value)}
                  className="palacio-input w-36 text-right"
                  placeholder="0"
                />
              </label>
              <button
                type="button"
                className="palacio-action-btn"
                onClick={() => onUsarMaximo(n)}
              >
                Usar el máximo
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
