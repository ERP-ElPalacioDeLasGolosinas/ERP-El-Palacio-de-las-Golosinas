import { notFound, redirect } from "next/navigation";
import PasarelaPago from "@/components/tienda/PasarelaPago";
import { createClient } from "@/lib/supabase/server";
import { obtenerClienteWeb } from "@/lib/tienda/registro";

export const metadata = { title: "Pagar pedido — El Palacio de las Golosinas" };

const precioFmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function metodoDe(medioPago) {
  if (medioPago === "Tarjeta de débito") return "debito";
  if (medioPago === "Tarjeta de crédito") return "credito";
  return "transferencia";
}

export default async function PagarPedido({ searchParams }) {
  const { pedido: id } = await searchParams;
  if (!UUID.test(id ?? "")) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await obtenerClienteWeb(supabase))) redirect("/tienda/login");

  const { data } = await supabase.rpc("fn_pedido_web_mi_obtener", { p_id_pedido: id });
  const pedido = Array.isArray(data) ? data[0] : data;
  if (!pedido) notFound();
  if (pedido.estado !== "Pendiente de pago") {
    redirect(`/tienda/checkout/confirmado?pedido=${encodeURIComponent(id)}`);
  }

  const metodo = metodoDe(pedido.medio_pago);
  let datosTransferencia = {};
  if (metodo === "transferencia") {
    const { data: datos } = await supabase.rpc("fn_tienda_datos_transferencia");
    datosTransferencia = Object.fromEntries((datos ?? []).map((d) => [d.clave, d.valor]));
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold tracking-tight">Pagar pedido N° {pedido.numero}</h1>
      <p className="mt-2 text-sm text-palacio-muted">Medio de pago: {pedido.medio_pago}</p>

      <ul className="palacio-card mt-4 divide-y divide-zinc-200">
        {pedido.lineas.map((l) => (
          <li key={l.nro_linea} className="flex flex-wrap items-baseline justify-between gap-2 p-3 text-sm">
            <span>
              {l.nombre_producto} · {Number(l.cantidad)} × {precioFmt.format(l.precio_unitario)}
            </span>
            <span className="font-semibold">{precioFmt.format(l.importe_linea)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-right text-xl font-bold">Total: {precioFmt.format(pedido.importe_total)}</p>

      <PasarelaPago
        idPedido={pedido.id_pedido}
        metodo={metodo}
        numeroPedido={pedido.numero}
        datosTransferencia={datosTransferencia}
      />
    </main>
  );
}
