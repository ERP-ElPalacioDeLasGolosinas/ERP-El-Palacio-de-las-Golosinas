import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { CancelarOrdenButton } from "@/components/ordenes-compra/CancelarOrdenButton";
import { obtenerOrden } from "@/lib/ordenes-compra/actions";
import { badgeEstadoOrden } from "@/lib/ordenes-compra/estado";

export const metadata = { title: "Orden de compra | Palacio · ERP" };

const fechaFmt = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const numFmt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 });
const monedaFmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

function formatFecha(valor) {
  if (!valor) return "—";
  const d = new Date(`${valor}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "—" : fechaFmt.format(d);
}

/** @param {{ params: Promise<{ id: string }> }} props */
export default async function OrdenDetallePage({ params }) {
  const { id } = await params;
  const { data, error } = await obtenerOrden(id);

  if (error) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
        <div className="palacio-card border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }
  if (!data?.orden) notFound();

  const orden = data.orden;
  const detalle = data.detalle ?? [];
  const facturas = data.facturas ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[
          { label: "Compras" },
          { label: "Órdenes de compra", href: "/compras/ordenes" },
          { label: orden.numero_formateado },
        ]}
        title={orden.numero_formateado}
        description={orden.nombre_proveedor}
        actions={
          orden.estado === "Pendiente" ? (
            <CancelarOrdenButton id={orden.id_orden_compra} numero={orden.numero_formateado} />
          ) : null
        }
      />

      <section className="palacio-card mb-6 p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">Datos de la orden</h2>
          <span className={badgeEstadoOrden(orden.estado)}>{orden.estado}</span>
        </div>
        <dl className="grid gap-4 text-sm md:grid-cols-2">
          <div>
            <dt className="text-xs font-medium tracking-wide text-palacio-muted uppercase">Proveedor</dt>
            <dd>{orden.nombre_proveedor}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-palacio-muted uppercase">Emisión</dt>
            <dd>{formatFecha(orden.fecha_emision)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-palacio-muted uppercase">Registró</dt>
            <dd>{orden.creado_por_nombre}</dd>
          </div>
          {orden.observaciones ? (
            <div className="md:col-span-2">
              <dt className="text-xs font-medium tracking-wide text-palacio-muted uppercase">Observaciones</dt>
              <dd>{orden.observaciones}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="palacio-card mb-6 overflow-x-auto">
        <div className="border-b border-palacio-border px-5 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">Artículos</h2>
        </div>
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-palacio-border">
              {["Artículo", "Solicitado", "Recibido", "Pendiente", "Precio estimado", "Estado"].map((h) => (
                <th key={h} className="px-4 py-3 text-[11px] font-semibold tracking-wider text-palacio-muted uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {detalle.map((d) => {
              const pendiente = Number(d.cantidad_solicitada) - Number(d.cantidad_recibida);
              return (
                <tr key={d.id_detalle} className="border-b border-palacio-border last:border-0">
                  <td className="px-4 py-3">{d.nombre_completo}</td>
                  <td className="px-4 py-3 tabular-nums">{numFmt.format(Number(d.cantidad_solicitada))}</td>
                  <td className="px-4 py-3 tabular-nums">{numFmt.format(Number(d.cantidad_recibida))}</td>
                  <td className="px-4 py-3 tabular-nums">{numFmt.format(pendiente)}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {d.precio_estimado == null ? "—" : monedaFmt.format(Number(d.precio_estimado))}
                  </td>
                  <td className="px-4 py-3">
                    {d.completo ? (
                      <span className="palacio-badge-activo">Recibido</span>
                    ) : Number(d.cantidad_recibida) > 0 ? (
                      <span className="palacio-badge-disponible">Parcial</span>
                    ) : (
                      <span className="palacio-badge-lleno">Pendiente</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="palacio-card overflow-x-auto">
        <div className="border-b border-palacio-border px-5 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">Facturas vinculadas</h2>
        </div>
        {facturas.length === 0 ? (
          <p className="px-5 py-6 text-sm text-palacio-muted">Todavía no hay facturas contra esta orden.</p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-palacio-border">
                {["Comprobante", "Fecha", "Importe", "Estado"].map((h) => (
                  <th key={h} className="px-4 py-3 text-[11px] font-semibold tracking-wider text-palacio-muted uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {facturas.map((f) => (
                <tr key={f.id_comprobante} className="border-b border-palacio-border last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/compras/comprobantes/${f.id_comprobante}`} className="font-medium text-palacio-red underline">
                      {f.nombre_tipo_comprobante} {f.numero_formateado}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{formatFecha(f.fecha_comprobante)}</td>
                  <td className="px-4 py-3 tabular-nums">{monedaFmt.format(Number(f.importe_total))}</td>
                  <td className="px-4 py-3">{f.anulado ? "Anulado" : f.estado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
