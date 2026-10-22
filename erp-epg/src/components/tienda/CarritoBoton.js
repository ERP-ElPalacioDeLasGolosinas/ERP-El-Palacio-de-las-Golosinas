"use client";

import { useTienda } from "./TiendaProvider";

// Sin sesión el carrito no existe: abre el modal de login y vuelve a /carrito.
// Con sesión abre el drawer sin salir de la página.
export default function CarritoBoton({ unidades }) {
  const { cliente, abrirLogin, abrirDrawer } = useTienda();
  const cantidad = cliente ? unidades : 0;
  const badge = cantidad > 99 ? "99+" : String(cantidad);
  const etiqueta = cantidad > 0 ? `Carrito, ${cantidad} ${cantidad === 1 ? "unidad" : "unidades"}` : "Carrito";

  return (
    <button
      type="button"
      aria-label={etiqueta}
      onClick={() => (cliente ? abrirDrawer() : abrirLogin({ next: "/carrito" }))}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-palacio-red text-white hover:opacity-90"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="20" r="1.5" />
        <circle cx="18" cy="20" r="1.5" />
        <path d="M2 3h3l2.7 12.4a1 1 0 0 0 1 .8h9.1a1 1 0 0 0 1-.8L20.5 8H6" />
      </svg>
      {cantidad > 0 && (
        <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-white px-1 text-xs font-bold leading-5 text-palacio-red ring-2 ring-palacio-red">
          {badge}
        </span>
      )}
    </button>
  );
}
