import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  obtenerProductoDetalle,
  obtenerStockPorDeposito,
  obtenerUltimosLotes,
} from "@/lib/stock/actions";

export const metadata = {
  title: "Detalle de stock | Palacio · ERP",
};

const numFmt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
const monedaFmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});
const fechaFmt = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatFecha(valor) {
  if (!valor) return "—";
  const d = new Date(`${valor}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "—" : fechaFmt.format(d);
}

/**
 * @param {{ params: Promise<{ id_producto: string }> }} props
 */
export default async function StockDetallePage({ params }) {
  const { id_producto: idProducto } = await params;

  const [productoRes, depositosRes, lotesRes] = await Promise.all([
    obtenerProductoDetalle(idProducto),
    obtenerStockPorDeposito(idProducto),
    obtenerUltimosLotes(idProducto),
  ]);

  if (productoRes.error) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
        <div className="palacio-card border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          Error al cargar: {productoRes.error}
        </div>
        <Link
          href="/inventario/stock"
          className="mt-4 inline-block text-sm font-medium text-palacio-red underline"
        >
          Volver al stock
        </Link>
      </div>
    );
  }

  const producto = productoRes.data;
  if (!producto) {
    notFound();
  }

  const desglose = depositosRes.data ?? [];
  const lotes = lotesRes.data ?? [];
  const stockTotal = desglose.reduce(
    (acc, d) => acc + Number(d.cantidad ?? 0),
    0
  );

  // Sección 2: lotes agrupados por depósito. Se conserva el orden global que
  // trae la función (vencimiento más próximo primero) dentro de cada grupo.
  // Se listan primero los depósitos del desglose de stock (sección 1) y luego
  // cualquier depósito que tenga lotes pero no figure en el desglose.
  const lotesPorDeposito = new Map();
  for (const l of lotes) {
    if (!lotesPorDeposito.has(l.id_deposito)) {
      lotesPorDeposito.set(l.id_deposito, {
        id_deposito: l.id_deposito,
        nombre_deposito: l.nombre_deposito,
        lotes: [],
      });
    }
    lotesPorDeposito.get(l.id_deposito).lotes.push(l);
  }

  const seccionesLotes = [];
  const vistos = new Set();
  for (const d of desglose) {
    const grupo = lotesPorDeposito.get(d.id_deposito);
    seccionesLotes.push({
      id_deposito: d.id_deposito,
      nombre_deposito: d.nombre_deposito,
      lotes: grupo?.lotes ?? [],
    });
    vistos.add(d.id_deposito);
  }
  for (const grupo of lotesPorDeposito.values()) {
    if (!vistos.has(grupo.id_deposito)) seccionesLotes.push(grupo);
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[
          { label: "Inventario" },
          { label: "Stock", href: "/inventario/stock" },
          { label: producto.nombre_producto ?? "Detalle" },
        ]}
        title={producto.nombre_completo ?? producto.nombre_producto}
        description={producto.descripcion_producto || undefined}
      />

      {/* Sección 1 — descripción general + desglose por depósito */}
      <section className="palacio-card mb-6 p-5 md:p-6">
        <h2 className="mb-4 text-sm font-semibold text-zinc-900">
          Descripción general
        </h2>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          <Dato label="Código" mono>
            {producto.codigo_producto}
          </Dato>
          <Dato label="Marca">{producto.nombre_marca ?? "—"}</Dato>
          <Dato label="Rubro">{producto.nombre_rubro ?? "—"}</Dato>
          <Dato label="Categoría">{producto.nombre_categoria ?? "—"}</Dato>
          <Dato label="Unidad de medida">
            {producto.numero_medida != null
              ? `${numFmt.format(Number(producto.numero_medida))} ${
                  producto.abreviatura_unidad_medida ??
                  producto.nombre_unidad_medida ??
                  ""
                }`.trim()
              : producto.nombre_unidad_medida ?? "—"}
          </Dato>
          <Dato label="Estado">
            {producto.activo ? "Activo" : "Inactivo"}
          </Dato>
          <Dato label="Costo">
            {producto.costo_producto != null
              ? monedaFmt.format(Number(producto.costo_producto))
              : "—"}
          </Dato>
          <Dato label="Precio mayorista">
            {producto.precio_mayorista_producto != null
              ? monedaFmt.format(Number(producto.precio_mayorista_producto))
              : "—"}
          </Dato>
          <Dato label="Precio minorista">
            {producto.precio_minorista_producto != null
              ? monedaFmt.format(Number(producto.precio_minorista_producto))
              : "—"}
          </Dato>
        </dl>

        <div className="mt-6 border-t border-palacio-border pt-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900">
              Stock por depósito
            </h3>
            <span className="text-sm text-palacio-muted">
              Total:{" "}
              <span className="font-semibold text-zinc-900 tabular-nums">
                {numFmt.format(stockTotal)}
              </span>{" "}
              unds
            </span>
          </div>
          {desglose.length === 0 ? (
            <p className="text-sm text-palacio-muted">
              Este producto no tiene stock en ningún depósito.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {desglose.map((d) => (
                <div
                  key={d.id_deposito}
                  className="rounded-lg border border-palacio-border bg-zinc-50/60 px-4 py-3"
                >
                  <p className="text-sm font-medium text-zinc-900">
                    {d.nombre_deposito}
                  </p>
                  <p className="mt-0.5 text-sm text-palacio-muted tabular-nums">
                    {numFmt.format(Number(d.cantidad ?? 0))} unds
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Sección 2 — lotes agrupados por depósito */}
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-zinc-900">
          Lotes por depósito
        </h2>
        {lotes.length > 0 ? (
          <span className="text-xs text-palacio-muted">
            {lotes.length} lote{lotes.length === 1 ? "" : "s"} en total
          </span>
        ) : null}
      </div>

      {lotesRes.error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          {lotesRes.error}
        </div>
      ) : seccionesLotes.length === 0 ? (
        <div className="palacio-card px-6 py-12 text-center">
          <p className="text-sm text-palacio-muted">
            Todavía no hay lotes registrados para este producto.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {seccionesLotes.map((s) => (
            <section
              key={s.id_deposito}
              className="palacio-card overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
                <h3 className="text-sm font-semibold text-zinc-900">
                  {s.nombre_deposito}
                </h3>
                <span className="text-xs text-palacio-muted">
                  {s.lotes.length} lote{s.lotes.length === 1 ? "" : "s"}
                </span>
              </div>

              {s.lotes.length === 0 ? (
                <div className="px-6 py-8 text-center">
                  <p className="text-sm text-palacio-muted">
                    Sin lotes registrados en este depósito.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm whitespace-nowrap">
                    <thead>
                      <tr className="border-b border-palacio-border bg-zinc-50/80">
                        <Th>Código</Th>
                        <Th>Producto</Th>
                        <Th>Fecha de elaboración</Th>
                        <Th className="text-right">Stock</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.lotes.map((l) => (
                        <tr
                          key={l.id_inventario_producto}
                          className="border-b border-palacio-border last:border-0"
                        >
                          <td className="px-5 py-4 align-middle">
                            <span className="font-mono text-xs text-zinc-700">
                              {l.codigo_producto}
                            </span>
                          </td>
                          <td className="px-5 py-4 align-middle font-medium text-zinc-900">
                            {l.nombre_completo}
                          </td>
                          <td className="px-5 py-4 align-middle text-palacio-muted">
                            {formatFecha(l.fecha_fabricacion)}
                          </td>
                          <td className="px-5 py-4 text-right align-middle tabular-nums text-zinc-900">
                            {l.stock}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      <p className="mt-4 text-xs text-palacio-muted">
        Cada tabla lista solo los lotes de ese depósito, ordenados por
        vencimiento más próximo. El stock se muestra como{" "}
        <span className="font-mono">disponible/total</span> recibido.
      </p>
    </div>
  );
}

function Dato({ label, children, mono = false }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] font-semibold tracking-wider text-palacio-muted uppercase">
        {label}
      </dt>
      <dd
        className={`text-sm text-zinc-900 ${mono ? "font-mono text-xs" : ""}`}
      >
        {children}
      </dd>
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
