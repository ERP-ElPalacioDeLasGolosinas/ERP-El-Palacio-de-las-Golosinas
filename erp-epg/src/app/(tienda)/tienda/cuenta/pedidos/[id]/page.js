import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EstadoPedidoBadge from "@/components/tienda/EstadoPedidoBadge";
import { obtenerClienteWeb } from "@/lib/tienda/registro";

export const metadata = { title: "Detalle del pedido — El Palacio de las Golosinas" };

const precioFmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const fechaFmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" });
const PASOS = ["Pendiente de pago", "Pagado", "En preparación", "Despachado"];
const UUID =/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function DetallePedido({ params }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await obtenerClienteWeb(supabase))) redirect("/tienda/login");

  const { data, error } = await supabase.rpc("fn_pedido_web_mi_obtener", { p_id_pedido: id });
  if (error) {
    return (
      <div>
        <p className="text-palacio-muted">No se pudo cargar el pedido. Probá de nuevo en un rato.</p>
      </div>
    );
  }
  const pedido = Array.isArray(data) ? data[0] : data;
  if (!pedido) notFound();

  const pendiente = pedido.estado === "Pendiente de pago";

  // Fecha en que el pedido alcanzó cada estado (la primera vez). Si hay saltos, el paso queda cumplido sin fecha.
  const fechaDe = {};
  for (const h of pedido.historial ?? []) fechaDe[h.estado] ??= h.fecha;
  const cancelado = pedido.estado === "Cancelado";
  const idxActual = PASOS.indexOf(pedido.estado);

  return (
    <div>
      <p className="text-sm"><Link href="/tienda/cuenta/pedidos">← Mis pedidos</Link></p>
      <h2 className="mt-3 text-lg font-semibold">Pedido N° {pedido.numero}</h2>
      <p className="mt-1 text-sm text-palacio-muted">
        {fechaFmt.format(new Date(pedido.creado))} · {pedido.medio_pago}
      </p>
      <p className="mt-3">
        Estado: <EstadoPedidoBadge estado={pedido.estado} />
        {pedido.fecha_pago ? ` (pagado el ${fechaFmt.format(new Date(pedido.fecha_pago))})` : null}
      </p>

      <section className="palacio-card mt-4 p-4">
        <h3 className="font-semibold">Seguimiento</h3>
        <ol className="mt-3 space-y-3 text-sm">
          {PASOS.map((paso, i) => {
            const cumplido = cancelado ? Boolean(fechaDe[paso]) : i <= idxActual;
            const fecha = fechaDe[paso];
            return (
              <li key={paso} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                    cumplido ? "bg-green-600 text-white" : "border border-zinc-300 text-transparent"
                  }`}
                >
                  ✓
                </span>
                <div>
                  <p className={cumplido ? "font-medium" : "text-palacio-muted"}>{paso}</p>
                  {cumplido && fecha ? (
                    <p className="text-xs text-palacio-muted">{fechaFmt.format(new Date(fecha))}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
          {cancelado ? (
            <li className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-600 text-xs text-white"
              >
                ✕
              </span>
              <div>
                <p className="font-medium text-red-700">Cancelado</p>
                {fechaDe.Cancelado ? (
                  <p className="text-xs text-palacio-muted">{fechaFmt.format(new Date(fechaDe.Cancelado))}</p>
                ) : null}
              </div>
            </li>
          ) : null}
        </ol>
      </section>

      <ul className="palacio-card mt-4 divide-y divide-zinc-200">
        {pedido.lineas.map((l) => (
          <li key={l.nro_linea} className="flex flex-wrap items-baseline justify-between gap-2 p-4">
            <div>
              <span className="text-xs text-palacio-muted">{l.nombre_marca}</span>
              <p className="font-medium">{l.nombre_producto}</p>
              <span className="text-sm text-palacio-muted">
                {l.presentacion} · {Number(l.cantidad)} × {precioFmt.format(l.precio_unitario)}
              </span>
            </div>
            <span className="font-semibold">{precioFmt.format(l.importe_linea)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-right text-xl font-bold">Total: {precioFmt.format(pedido.importe_total)}</p>

      <section className="palacio-card mt-6 p-4">
        <h3 className="font-semibold">Forma de pago</h3>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-palacio-muted">Medio</dt>
          <dd className="font-medium">{pedido.medio_pago}</dd>
          <dt className="text-palacio-muted">Estado del pago</dt>
          <dd className="font-medium">
            {pedido.fecha_pago ? "Pagado" : pedido.estado === "Cancelado" ? "Cancelado" : "Pendiente de pago"}
          </dd>
          {pedido.fecha_pago ? (
            <>
              <dt className="text-palacio-muted">Fecha de pago</dt>
              <dd className="font-medium">{fechaFmt.format(new Date(pedido.fecha_pago))}</dd>
            </>
          ) : null}
        </dl>
        {pendiente ? (
          <div className="mt-4 border-t border-zinc-200 pt-3">
            <Link href={`/tienda/checkout/pago?pedido=${pedido.id_pedido ?? id}`} className="palacio-btn-primary inline-block">
              Pagar ahora
            </Link>
          </div>
        ) : null}
      </section>

      <p className="mt-6 text-sm">
        ¿Tenés un problema con este pedido?{" "}
        <Link href={`/tienda/cuenta/soporte/nuevo?pedido=${pedido.id_pedido ?? id}`}>Abrir ticket</Link>
      </p>
    </div>
  );
}
