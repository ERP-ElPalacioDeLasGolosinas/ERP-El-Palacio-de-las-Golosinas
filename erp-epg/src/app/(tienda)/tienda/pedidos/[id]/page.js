import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { obtenerClienteWeb } from "@/lib/tienda/registro";

export const metadata = { title: "Detalle del pedido — El Palacio de las Golosinas" };

const precioFmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const fechaFmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function DetallePedido({ params }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await obtenerClienteWeb(supabase))) redirect("/login");

  const { data, error } = await supabase.rpc("fn_pedido_web_mi_obtener", { p_id_pedido: id });
  if (error) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-palacio-muted">No se pudo cargar el pedido. Probá de nuevo en un rato.</p>
      </main>
    );
  }
  const pedido = Array.isArray(data) ? data[0] : data;
  if (!pedido) notFound();

  return (
    <main className="mx-auto max-w-3xl p-6">
      <p className="text-sm"><Link href="/pedidos">← Mis pedidos</Link></p>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">Pedido N° {pedido.numero}</h1>
      <p className="mt-1 text-sm text-palacio-muted">
        {fechaFmt.format(new Date(pedido.creado))} · {pedido.medio_pago}
      </p>
      <p className="mt-3">
        Estado: <span className="font-semibold">{pedido.estado}</span>
        {pedido.fecha_pago ? ` (pagado el ${fechaFmt.format(new Date(pedido.fecha_pago))})` : null}
      </p>

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
    </main>
  );
}
