import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { obtenerClienteWeb } from "@/lib/tienda/registro";

export const metadata = { title: "Pedido — El Palacio de las Golosinas" };

const precioFmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const fechaFmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PedidoConfirmado({ searchParams }) {
  const { pedido: id } = await searchParams;
  if (!UUID.test(id ?? "")) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await obtenerClienteWeb(supabase))) redirect("/tienda/login");

  const { data: pedidoData } = await supabase.rpc("fn_pedido_web_mi_obtener", { p_id_pedido: id });
  const pedido = Array.isArray(pedidoData) ? pedidoData[0] : pedidoData;
  if (!pedido) notFound();

  const pagado = Boolean(pedido.fecha_pago);
  const pendiente = pedido.estado === "Pendiente de pago";

  return (
    <main className="mx-auto max-w-3xl p-6">
      {pagado ? (
        <>
          <h1 className="text-2xl font-bold tracking-tight">¡Pago aprobado!</h1>
          <p className="mt-4">
            Recibimos el pago de tu pedido N° {pedido.numero} por{" "}
            <span className="font-semibold">{precioFmt.format(pedido.importe_total)}</span>.
          </p>
          <dl className="palacio-card mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 p-4 text-sm">
            <dt className="text-palacio-muted">Medio de pago</dt>
            <dd className="font-medium">{pedido.medio_pago}</dd>
            <dt className="text-palacio-muted">Fecha</dt>
            <dd className="font-medium">{fechaFmt.format(new Date(pedido.fecha_pago))}</dd>
          </dl>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold tracking-tight">
            {pendiente ? "¡Pedido registrado!" : `Pedido N° ${pedido.numero}`}
          </h1>
          <p className="mt-4">
            {pendiente ? (
              <>
                Tu pedido N° {pedido.numero} está pendiente de pago por{" "}
                <span className="font-semibold">{precioFmt.format(pedido.importe_total)}</span>.
              </>
            ) : (
              <>Estado: {pedido.estado}.</>
            )}
          </p>
          {pendiente ? (
            <Link href={`/tienda/checkout/pago?pedido=${pedido.id_pedido}`} className="palacio-btn-primary mt-6 inline-block">
              Ir a pagar
            </Link>
          ) : null}
        </>
      )}

      <p className="mt-6 text-sm">
        <Link href="/tienda">← Volver a la tienda</Link> · <Link href={`/tienda/cuenta/pedidos/${pedido.id_pedido}`}>Ver el pedido</Link> ·{" "}
        <Link href="/tienda/cuenta/pedidos">Mis pedidos</Link>
      </p>
    </main>
  );
}
