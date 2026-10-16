import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { leerCarrito, validarCarrito } from "@/lib/tienda/carrito";
import { obtenerClienteWeb } from "@/lib/tienda/registro";
import TiendaHeader from "@/components/tienda/TiendaHeader";
import { cambiarCantidad, quitarDelCarrito } from "./actions";

export const metadata = { title: "Carrito — El Palacio de las Golosinas" };

const precioFmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

const AVISOS = {
  stock_insuficiente: "No hay stock suficiente para esa cantidad.",
  agotado: "Agotado.",
  no_disponible: "Ya no está disponible.",
};

export default async function TiendaCarrito() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/tienda?login=1&next=/carrito");
  const items = await leerCarrito();
  const [cliente, { lineas, error }] = await Promise.all([
    obtenerClienteWeb(supabase),
    validarCarrito(supabase, items),
  ]);

  // Se conserva el orden en que se agregaron los artículos.
  const porId = new Map(lineas.map((l) => [l.id_producto, l]));
  const filas = items.map((it) => porId.get(it.id_producto)).filter(Boolean);
  const total = filas
    .filter((l) => l.estado === "ok")
    .reduce((acc, l) => acc + Number(l.precio) * Number(l.cantidad_solicitada), 0);
  const conProblemas = filas.some((l) => l.estado !== "ok");

  return (
    <>
    <TiendaHeader cliente={cliente} />
    <main className="mx-auto max-w-3xl p-6">
      <p className="text-sm"><Link href="/tienda">← Seguir comprando</Link></p>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">Tu carrito</h1>

      {error ? (
        <p className="mt-6 text-palacio-muted">No se pudo cargar el carrito. Probá de nuevo en un rato.</p>
      ) : items.length === 0 ? (
        <p className="mt-6 text-palacio-muted">El carrito está vacío.</p>
      ) : (
        <>
          <ul className="mt-4 flex flex-col gap-3">
            {filas.map((l) => (
              <li key={l.id_producto} className="palacio-card flex flex-col gap-2 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <span className="text-xs text-palacio-muted">{l.nombre_marca}</span>
                    <h2 className="font-semibold">{l.nombre_producto}</h2>
                    <span className="text-sm text-palacio-muted">{l.presentacion}</span>
                  </div>
                  {l.estado !== "no_disponible" ? (
                    <span className="flex items-baseline gap-2">
                      <span className="text-lg font-bold">{precioFmt.format(l.precio)}</span>
                      {l.en_oferta ? (
                        <span className="text-sm text-palacio-muted line-through">{precioFmt.format(l.precio_lista)}</span>
                      ) : null}
                    </span>
                  ) : null}
                </div>
                {l.estado !== "ok" ? (
                  <p className="text-sm font-medium text-red-700">
                    {AVISOS[l.estado]}
                    {l.estado === "stock_insuficiente"
                      ? ` Disponibles: ${Number(l.stock_disponible)}.`
                      : ""}
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  {l.estado !== "no_disponible" ? (
                    <form action={cambiarCantidad} className="flex items-center gap-2">
                      <input type="hidden" name="id_producto" value={l.id_producto} />
                      <input
                        type="number"
                        name="cantidad"
                        min="1"
                        max="9999"
                        defaultValue={Number(l.cantidad_solicitada)}
                        aria-label={`Cantidad de ${l.nombre_producto}`}
                        className="palacio-input w-24"
                      />
                      <button type="submit" className="palacio-btn-secondary px-3 py-2 text-sm">
                        Actualizar
                      </button>
                    </form>
                  ) : null}
                  <form action={quitarDelCarrito}>
                    <input type="hidden" name="id_producto" value={l.id_producto} />
                    <button type="submit" className="palacio-btn-secondary px-3 py-2 text-sm">
                      Quitar
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-6 text-right text-xl font-bold">Total: {precioFmt.format(total)}</p>
          {conProblemas ? (
            <p className="mt-2 text-right text-sm text-palacio-muted">
              Corregí o quitá los artículos con aviso para continuar.
            </p>
          ) : (
            <p className="mt-4 text-right">
              <Link href="/tienda/checkout" className="palacio-btn-primary px-5 py-2.5 text-sm">
                Continuar con la compra
              </Link>
            </p>
          )}
        </>
      )}
    </main>
    </>
  );
}
