import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TicketNuevoForm from "@/components/tienda/TicketNuevoForm";

export const metadata = { title: "Nueva consulta — El Palacio de las Golosinas" };

export default async function CuentaSoporteNuevo({ searchParams }) {
  const { pedido } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.rpc("fn_pedido_web_mis_listar");
  const pedidos = data ?? [];
  const idInicial = pedidos.some((p) => p.id_pedido === pedido) ? pedido : null;

  return (
    <section>
      <Link href="/tienda/cuenta/soporte" className="text-sm text-palacio-muted hover:text-palacio-red">
        ← Volver a Soporte
      </Link>
      <h2 className="mb-3 mt-2 text-lg font-semibold">Nueva consulta</h2>
      <TicketNuevoForm pedidos={pedidos} idPedidoInicial={idInicial} />
    </section>
  );
}
