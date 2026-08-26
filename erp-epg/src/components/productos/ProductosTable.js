function formatearPrecio(valor) {
  if (valor === null || valor === undefined) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(valor);
}

/**
 * @param {{ productos: import('@/lib/productos/types').Producto[] }} props
 */
export function ProductosTable({ productos }) {
  if (!productos.length) {
    return (
      <div className="card px-6 py-12 text-center">
        <p className="text-sm text-ink-muted">No hay artículos cargados.</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold text-ink">Listado</h2>
        <span className="text-xs text-ink-muted">
          {productos.length} artículo{productos.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-zinc-50/80">
              <th className="px-5 py-3 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
                Código
              </th>
              <th className="px-5 py-3 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
                Nombre
              </th>
              <th className="px-5 py-3 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
                Marca
              </th>
              <th className="px-5 py-3 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
                Unidad
              </th>
              <th className="px-5 py-3 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
                Rubro / Categoría
              </th>
              <th className="px-5 py-3 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
                Precio costo
              </th>
              <th className="px-5 py-3 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
                Estado
              </th>
            </tr>
          </thead>
          <tbody>
            {productos.map((p) => (
              <tr key={p.id_producto} className="border-b border-border last:border-0">
                <td className="px-5 py-3.5 font-mono text-xs text-ink">
                  {p.codigo_producto}
                </td>
                <td className="px-5 py-3.5">
                  <p className="font-semibold text-ink">{p.nombre_producto}</p>
                  <p className="text-xs text-ink-muted">
                    {p.descripcion_producto}
                  </p>
                </td>
                <td className="px-5 py-3.5 text-ink">
                  {p.marca?.nombre_marca ?? "—"}
                </td>
                <td className="px-5 py-3.5 text-ink">
                  {p.unidad_medida?.abreviatura_unidad_medida ?? "—"}
                </td>
                <td className="px-5 py-3.5 text-ink">
                  {p.categoria?.rubro?.nombre_rubro ?? "—"} /{" "}
                  {p.categoria?.nombre_categoria ?? "—"}
                </td>
                <td className="px-5 py-3.5 text-ink">
                  {formatearPrecio(p.precio_costo_producto)}
                </td>
                <td className="px-5 py-3.5">
                  <span
                    className={
                      p.activo
                        ? "inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700"
                        : "inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-600"
                    }
                  >
                    {p.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
