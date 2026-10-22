import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { leerCarrito, validarCarrito } from "@/lib/tienda/carrito";
import { obtenerClienteWeb } from "@/lib/tienda/registro";
import CompletarDatos from "@/components/tienda/CompletarDatos";
import ConfirmarPedido from "@/components/tienda/ConfirmarPedido";

export const metadata = { title: "Finalizar compra — El Palacio de las Golosinas" };

const precioFmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

export default async function TiendaCheckout() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const cliente = user ? await obtenerClienteWeb(supabase) : null;
  if (!cliente) redirect("/tienda/login?next=/checkout");
  const datosCompletos = Boolean(cliente.documento_cliente && cliente.telefono_cliente);

  const items = await leerCarrito();
  if (items.length === 0) redirect("/tienda/carrito");
  const { lineas, error } = await validarCarrito(supabase, items);
  if (error) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-palacio-muted">No se pudo cargar el pedido. Probá de nuevo en un rato.</p>
      </main>
    );
  }

  const porId = new Map(lineas.map((l) => [l.id_producto, l]));
  const filas = items.map((it) => porId.get(it.id_producto)).filter(Boolean);
  if (filas.some((l) => l.estado !== "ok")) redirect("/tienda/carrito");
  const subtotal = filas.reduce((acc, l) => acc + Number(l.precio) * Number(l.cantidad_solicitada), 0);
  const [{ data: costo }, { data: sucursales }] = await Promise.all([
    supabase.rpc("fn_tienda_costo_envio"),
    supabase.rpc("fn_tienda_sucursales_retiro", {
      p_items: items.map((l) => ({ id_producto: l.id_producto, cantidad: l.cantidad })),
    }),
  ]);
  const costoEnvio = Number(costo ?? 0);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <p className="text-sm"><Link href="/tienda/carrito">← Volver al carrito</Link></p>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">Finalizar compra</h1>

      <section className="mt-4">
        <h2 className="font-semibold">Resumen</h2>
        <ul className="palacio-card mt-2 divide-y divide-zinc-200">
          {filas.map((l) => (
            <li key={l.id_producto} className="flex flex-wrap items-baseline justify-between gap-2 p-4">
              <div>
                <span className="text-xs text-palacio-muted">{l.nombre_marca}</span>
                <p className="font-medium">{l.nombre_producto}</p>
                <span className="text-sm text-palacio-muted">
                  {l.presentacion} · {Number(l.cantidad_solicitada)} × {precioFmt.format(l.precio)}
                </span>
              </div>
              <span className="font-semibold">
                {precioFmt.format(Number(l.precio) * Number(l.cantidad_solicitada))}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-right text-sm text-palacio-muted">Subtotal: {precioFmt.format(subtotal)}</p>
      </section>

      {datosCompletos ? (
        <ConfirmarPedido
          subtotal={subtotal}
          costoEnvio={costoEnvio}
          sucursales={Array.isArray(sucursales) ? sucursales : []}
          nombre={cliente.nombre_cliente}
          direccion={cliente.direccion_cliente}
        />
      ) : (
        <section className="mt-6">
          <h2 className="font-semibold">Completá tus datos</h2>
          <CompletarDatos
            documento={cliente.documento_cliente}
            telefono={cliente.telefono_cliente}
            direccion={cliente.direccion_cliente}
          />
        </section>
      )}
    </main>
  );
}
