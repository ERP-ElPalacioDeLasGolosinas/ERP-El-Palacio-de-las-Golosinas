import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EstadoPedidoBadge from "@/components/tienda/EstadoPedidoBadge";
import { obtenerClienteWeb } from "@/lib/tienda/registro";

export const metadata = { title: "Mis pedidos — El Palacio de las Golosinas" };

const precioFmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const fechaFmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" });

export default async function MisPedidos() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await obtenerClienteWeb(supabase))) redirect("/tienda/login");

  const { data, error } = await supabase.rpc("fn_pedido_web_mis_listar");
  const pedidos = data ?? [];

  return (
    <div>
      <h2 className="text-lg font-semibold">Mis pedidos</h2>

      {error ? (
        <p className="mt-6 text-palacio-muted">No se pudieron cargar tus pedidos. Probá de nuevo en un rato.</p>
      ) : pedidos.length === 0 ? (
        <p className="mt-6 text-palacio-muted">Todavía no hiciste ningún pedido.</p>
      ) : (
        <ul className="palacio-card mt-4 divide-y divide-zinc-200">
          {pedidos.map((p) => (
            <li key={p.id_pedido} className="flex flex-wrap items-baseline justify-between gap-2 p-4">
              <div>
                <Link href={`/tienda/cuenta/pedidos/${p.id_pedido}`} className="font-medium">Pedido N° {p.numero}</Link>
                <p className="text-sm text-palacio-muted">
                  {fechaFmt.format(new Date(p.creado))} · {p.cantidad_lineas}{" "}
                  {Number(p.cantidad_lineas) === 1 ? "artículo" : "artículos"}
                </p>
              </div>
              <div className="text-right">
                <span className="font-semibold">{precioFmt.format(p.importe_total)}</span>
                <p className="mt-1"><EstadoPedidoBadge estado={p.estado} /></p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
