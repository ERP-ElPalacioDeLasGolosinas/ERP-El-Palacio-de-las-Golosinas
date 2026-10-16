import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { obtenerClienteWeb } from "@/lib/tienda/registro";

export const metadata = { title: "Pedido registrado — El Palacio de las Golosinas" };

const precioFmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CAMPOS = [
  ["transferencia_titular", "Titular"],
  ["transferencia_banco", "Banco"],
  ["transferencia_cbu", "CBU"],
  ["transferencia_alias", "Alias"],
  ["transferencia_cuit", "CUIT"],
];

export default async function PedidoConfirmado({ searchParams }) {
  const { pedido: id } = await searchParams;
  if (!UUID.test(id ?? "")) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await obtenerClienteWeb(supabase))) redirect("/login");

  const [{ data: pedidoData }, { data: datos }] = await Promise.all([
    supabase.rpc("fn_pedido_web_mi_obtener", { p_id_pedido: id }),
    supabase.rpc("fn_tienda_datos_transferencia"),
  ]);
  const pedido = Array.isArray(pedidoData) ? pedidoData[0] : pedidoData;
  if (!pedido) notFound();

  const valores = Object.fromEntries((datos ?? []).map((d) => [d.clave, d.valor]));
  const campos = CAMPOS.filter(([clave]) => valores[clave]);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold tracking-tight">¡Pedido registrado!</h1>
      <p className="mt-4">
        Tu pedido N° {pedido.numero} quedó pendiente de pago por{" "}
        <span className="font-semibold">{precioFmt.format(pedido.importe_total)}</span>.
      </p>

      <section className="palacio-card mt-6 p-4">
        <h2 className="font-semibold">Datos para la transferencia</h2>
        {campos.length > 0 ? (
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {campos.map(([clave, etiqueta]) => (
              <div key={clave} className="contents">
                <dt className="text-palacio-muted">{etiqueta}</dt>
                <dd className="font-medium">{valores[clave]}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-3 text-sm text-palacio-muted">
            Todavía no están cargados los datos bancarios. Nos vamos a comunicar para indicarte cómo pagar.
          </p>
        )}
        {valores.transferencia_instrucciones ? (
          <p className="mt-3 text-sm">{valores.transferencia_instrucciones}</p>
        ) : null}
        <p className="mt-3 text-sm text-palacio-muted">
          Indicá el N° de pedido en el concepto. Cuando recibamos el pago, tu pedido pasa a Pagado.
        </p>
      </section>

      <p className="mt-6 text-sm">
        <Link href="/">← Volver a la tienda</Link> · <Link href={`/pedidos/${pedido.id_pedido}`}>Ver el pedido</Link> ·{" "}
        <Link href="/pedidos">Mis pedidos</Link>
      </p>
    </main>
  );
}
