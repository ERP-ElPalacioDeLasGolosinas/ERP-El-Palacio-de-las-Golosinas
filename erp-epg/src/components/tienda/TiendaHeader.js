import Link from "next/link";
import CarritoLink from "@/components/tienda/CarritoLink";
import AccesoBotones from "@/components/tienda/AccesoBotones";
import { logoutTienda } from "@/app/(tienda)/tienda/actions";

export default function TiendaHeader({ cliente, q = "" }) {
  return (
    <header className="sticky top-0 z-30 border-b border-palacio-border bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <Link href="/tienda" className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-palacio-red">
          <span aria-hidden="true" className="text-2xl">🍬</span>
          <span className="leading-tight">El Palacio<span className="block text-xs font-semibold text-palacio-muted">de las Golosinas</span></span>
        </Link>

        <form method="get" action="/tienda/catalogo" className="order-3 flex w-full flex-1 md:order-none md:w-auto">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Buscar golosinas, alfajores, marcas…"
            aria-label="Buscar"
            className="palacio-input min-w-0 flex-1 rounded-r-none"
          />
          <button type="submit" className="palacio-btn-primary rounded-l-none px-5 text-sm">Buscar</button>
        </form>

        <nav className="ml-auto flex items-center gap-4 text-sm font-medium">
          {cliente ? (
            <>
              <span className="hidden text-palacio-muted sm:inline">Hola, {cliente.nombre_cliente}</span>
              <Link href="/tienda/pedidos" className="hover:text-palacio-red">Mis pedidos</Link>
              <form action={logoutTienda}>
                <button type="submit" className="hover:text-palacio-red">Salir</button>
              </form>
            </>
          ) : (
            <AccesoBotones />
          )}
          <span className="rounded-full bg-palacio-red px-4 py-1.5 text-white">
            <CarritoLink />
          </span>
        </nav>
      </div>
    </header>
  );
}
