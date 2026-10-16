import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { esUuid, obtenerProducto } from "@/lib/tienda/catalogo";
import { obtenerClienteWeb } from "@/lib/tienda/registro";
import TiendaHeader from "@/components/tienda/TiendaHeader";
import AgregarAlCarrito from "@/components/tienda/AgregarAlCarrito";

export const metadata = { title: "Artículo — El Palacio de las Golosinas" };

const precioFmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

export default async function TiendaProducto({ params }) {
  const { id } = await params;
  if (!esUuid(id)) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [cliente, { producto, error }] = await Promise.all([
    user ? obtenerClienteWeb(supabase) : null,
    obtenerProducto(supabase, id),
  ]);
  if (error) {
    return (
      <>
        <TiendaHeader cliente={cliente} />
        <main className="mx-auto max-w-3xl p-6">
          <p className="text-palacio-muted">No se pudo cargar el artículo. Probá de nuevo en un rato.</p>
          <p className="mt-4"><Link href="/tienda">← Volver al catálogo</Link></p>
        </main>
      </>
    );
  }
  if (!producto) notFound();
  const agotado = Number(producto.stock_disponible) <= 0;

  return (
    <>
    <TiendaHeader cliente={cliente} />
    <main className="mx-auto max-w-4xl p-6">
      <p className="text-sm"><Link href="/tienda">← Volver al catálogo</Link></p>
      <article className="palacio-card mt-4 grid gap-6 p-6 md:grid-cols-2">
        <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#ffe1e3] to-[#ffc2c7]">
          {producto.imagen_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={producto.imagen_url} alt={producto.nombre_producto} className="absolute inset-0 size-full object-cover" />
          ) : (
            <span aria-hidden="true" className="text-9xl">🍬</span>
          )}
          {producto.en_oferta ? (
            <span className="absolute right-3 top-3 rounded-full bg-palacio-red px-3 py-1 text-sm font-bold text-white shadow">
              -{Math.round((1 - Number(producto.precio) / Number(producto.precio_lista)) * 100)}%
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
        <span className="text-sm text-palacio-muted">{producto.nombre_marca}</span>
        <h1 className="text-2xl font-bold tracking-tight">{producto.nombre_producto}</h1>
        <span className="text-palacio-muted">{producto.presentacion}</span>
        <span className="mt-2 flex items-baseline gap-3">
          <span className="text-3xl font-bold text-palacio-red">{precioFmt.format(producto.precio)}</span>
          {producto.en_oferta ? (
            <span className="text-lg text-palacio-muted line-through">{precioFmt.format(producto.precio_lista)}</span>
          ) : null}
        </span>
        {agotado ? (
          <span className="font-medium text-red-700">Agotado</span>
        ) : (
          <>
            <span className="text-sm text-palacio-muted">Disponible</span>
            <AgregarAlCarrito idProducto={producto.id_producto ?? id} conCantidad />
          </>
        )}
        {producto.descripcion_producto ? <p className="mt-3">{producto.descripcion_producto}</p> : null}
        {producto.nombre_categoria || producto.nombre_rubro ? (
          <p className="mt-2 text-sm text-palacio-muted">
            {[producto.nombre_rubro, producto.nombre_categoria].filter(Boolean).join(" · ")}
          </p>
        ) : null}
        </div>
      </article>
    </main>
    </>
  );
}
