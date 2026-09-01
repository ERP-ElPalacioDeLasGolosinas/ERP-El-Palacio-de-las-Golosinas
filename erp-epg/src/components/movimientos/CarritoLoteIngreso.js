"use client";

/**
 * Carrito propio del flujo "ingreso por compra", como tabla: una fila por
 * producto, con cantidad, fechas de elaboración / vencimiento y observaciones
 * editables como celdas (datos que viven en `inventario_producto`, no en
 * `movimiento_stock`).
 *
 * @param {{
 *   items: Array<{
 *     id_producto: string,
 *     codigo_producto: string,
 *     nombre_completo: string,
 *     cantidad: string,
 *     fecha_elaboracion?: string,
 *     fecha_vencimiento?: string,
 *     observaciones?: string,
 *   }>,
 *   onActualizar: (idx: number, cambios: Record<string, string>) => void,
 *   onQuitar: (idx: number) => void,
 *   vencimientoRequerido?: boolean,
 * }} props
 */
export function CarritoLoteIngreso({
  items,
  onActualizar,
  onQuitar,
  vencimientoRequerido = true,
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-palacio-border px-4 py-6 text-center text-sm text-palacio-muted">
        Todavía no agregaste productos a este lote.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-palacio-border">
      <table className="min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-palacio-border bg-zinc-50/80">
            <Th>Producto</Th>
            <Th>
              Cantidad <span className="text-palacio-red">*</span>
            </Th>
            <Th>Fecha de elaboración</Th>
            <Th>
              Fecha de vencimiento{" "}
              {vencimientoRequerido ? (
                <span className="text-palacio-red">*</span>
              ) : null}
            </Th>
            <Th>Observaciones</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr
              key={`${item.id_producto}-${idx}`}
              className="border-b border-palacio-border last:border-0"
            >
              <td className="px-3 py-2 align-top">
                <p className="font-medium text-zinc-800">
                  {item.codigo_producto}
                </p>
                <p className="text-xs text-palacio-muted">
                  {item.nombre_completo}
                </p>
              </td>
              <td className="px-3 py-2 align-top">
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={item.cantidad}
                  onChange={(e) =>
                    onActualizar(idx, { cantidad: e.target.value })
                  }
                  className="palacio-input w-24"
                />
              </td>
              <td className="px-3 py-2 align-top">
                <input
                  type="date"
                  value={item.fecha_elaboracion ?? ""}
                  onChange={(e) =>
                    onActualizar(idx, { fecha_elaboracion: e.target.value })
                  }
                  className="palacio-input w-40"
                />
              </td>
              <td className="px-3 py-2 align-top">
                <input
                  type="date"
                  value={item.fecha_vencimiento ?? ""}
                  onChange={(e) =>
                    onActualizar(idx, { fecha_vencimiento: e.target.value })
                  }
                  className="palacio-input w-40"
                />
              </td>
              <td className="px-3 py-2 align-top">
                <input
                  type="text"
                  value={item.observaciones ?? ""}
                  onChange={(e) =>
                    onActualizar(idx, { observaciones: e.target.value })
                  }
                  className="palacio-input w-40"
                  placeholder="Opcional"
                />
              </td>
              <td className="px-3 py-2 align-top text-right">
                <button
                  type="button"
                  onClick={() => onQuitar(idx)}
                  className="text-sm font-medium text-palacio-red hover:underline"
                >
                  Quitar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, className = "" }) {
  return (
    <th
      className={`px-3 py-2 text-[11px] font-semibold tracking-wider text-palacio-muted uppercase ${className}`}
    >
      {children}
    </th>
  );
}
