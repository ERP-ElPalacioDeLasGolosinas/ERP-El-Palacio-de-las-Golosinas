"use client";

import { useRef } from "react";

// Fila horizontal con scroll-snap y flechas; las tarjetas llegan como children (server components).
export default function FilaCarrusel({ children, etiqueta }) {
  const pista = useRef(null);

  const mover = (dir) => {
    const el = pista.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <div className="group relative">
      <ul
        ref={pista}
        aria-label={etiqueta}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </ul>
      <button
        type="button"
        onClick={() => mover(-1)}
        aria-label="Ver anteriores"
        className="absolute -left-3 top-1/3 hidden h-10 w-10 items-center justify-center rounded-full border border-palacio-border bg-white text-xl shadow transition hover:bg-palacio-red-soft md:flex"
      >
        ‹
      </button>
      <button
        type="button"
        onClick={() => mover(1)}
        aria-label="Ver siguientes"
        className="absolute -right-3 top-1/3 hidden h-10 w-10 items-center justify-center rounded-full border border-palacio-border bg-white text-xl shadow transition hover:bg-palacio-red-soft md:flex"
      >
        ›
      </button>
    </div>
  );
}
