/**
 * @param {{ filas: Array<{
 *   id_stock: string,
 *   codigo_producto: string,
 *   producto: string,
 *   cantidad: number,
 *   nombre_deposito: string,
 *   unidad_medida: string,
 * }> }} props
 */
export function StockTable({ filas }) {
  if (!filas.length) {
    return (
      <div className="palacio-card px-6 py-12 text-center">
        <p className="text-sm text-palacio-muted">No hay stock para mostrar.</p>
      </div>
    );
  }

  return (
    <div className="palacio-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
        <h2 className="text-sm font-semibold text-zinc-900">Listado</h2>
        <span className="text-xs text-palacio-muted">
          {filas.length} registro{filas.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-palacio-border bg-zinc-50/80">
              <th className="px-5 py-3 text-left text-[11px] font-semibold tracking-wider text-palacio-muted uppercase">
                Código
              </th>
              <th className="px-5 py-3 text-left text-[11px] font-semibold tracking-wider text-palacio-muted uppercase">
                Producto
              </th>
              <th className="px-5 py-3 text-right text-[11px] font-semibold tracking-wider text-palacio-muted uppercase">
                Stock
              </th>
              <th className="px-5 py-3 text-left text-[11px] font-semibold tracking-wider text-palacio-muted uppercase">
                Depósito
              </th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
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
                  <span className="font-medium text-zinc-900">{f.producto}</span>
                </td>
                <td className="px-5 py-4 text-right align-middle tabular-nums text-zinc-900">
                  {formatCantidad(f.cantidad)}
                  {f.unidad_medida ? (
                    <span className="ml-1 text-xs text-palacio-muted">
                      {f.unidad_medida}
                    </span>
                  ) : null}
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
  );
}

function formatCantidad(valor) {
  const n = Number(valor ?? 0);
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(n);
}
