"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { logoutTienda } from "@/app/(tienda)/tienda/actions";

const ENLACES = [
  { href: "/tienda/cuenta", label: "Mi cuenta" },
  { href: "/tienda/cuenta/pedidos", label: "Mis pedidos" },
  { href: "/tienda/cuenta/soporte", label: "Soporte" },
];

export default function MenuUsuario({ nombre }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!abierto) return;
    const cerrarAfuera = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false);
    };
    const cerrarEsc = (e) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("mousedown", cerrarAfuera);
    document.addEventListener("keydown", cerrarEsc);
    return () => {
      document.removeEventListener("mousedown", cerrarAfuera);
      document.removeEventListener("keydown", cerrarEsc);
    };
  }, [abierto]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        className="flex items-center gap-1 hover:text-palacio-red"
      >
        <span className="max-w-[10rem] truncate">Hola, {nombre}</span>
        <span aria-hidden="true" className="text-xs">▾</span>
      </button>
      {abierto && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-2 w-48 overflow-hidden rounded-lg border border-palacio-border bg-white py-1 shadow-lg"
        >
          {ENLACES.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              role="menuitem"
              onClick={() => setAbierto(false)}
              className="block px-4 py-2 hover:bg-palacio-bg hover:text-palacio-red"
            >
              {label}
            </Link>
          ))}
          <form action={logoutTienda} className="border-t border-palacio-border">
            <button type="submit" role="menuitem" className="block w-full px-4 py-2 text-left hover:bg-palacio-bg hover:text-palacio-red">
              Salir
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
