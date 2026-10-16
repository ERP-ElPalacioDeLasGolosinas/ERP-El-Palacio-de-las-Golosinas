"use client";

import Link from "next/link";
import { useTienda } from "./TiendaProvider";

// Sin sesión el carrito no existe: el enlace abre el modal de login y vuelve a /carrito.
export default function CarritoBoton({ unidades }) {
  const { cliente, abrirLogin } = useTienda();
  const texto = `Carrito${cliente && unidades > 0 ? ` (${unidades})` : ""}`;
  if (!cliente) {
    return (
      <button type="button" onClick={() => abrirLogin({ next: "/carrito" })}>
        {texto}
      </button>
    );
  }
  return <Link href="/tienda/carrito">{texto}</Link>;
}
