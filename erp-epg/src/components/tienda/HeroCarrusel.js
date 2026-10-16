"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function HeroCarrusel({ banners }) {
  const [actual, setActual] = useState(0);
  const [pausado, setPausado] = useState(false);
  const total = banners.length;

  useEffect(() => {
    if (pausado || total < 2) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const t = setInterval(() => setActual((i) => (i + 1) % total), 5500);
    return () => clearInterval(t);
  }, [pausado, total]);

  const ir = (i) => setActual((i + total) % total);

  return (
    <section
      aria-roledescription="carrusel"
      aria-label="Destacados"
      className="relative overflow-hidden rounded-2xl shadow-sm"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
    >
      <div
        className="flex transition-transform duration-700 ease-out"
        style={{ transform: `translateX(-${actual * 100}%)` }}
      >
        {banners.map((b, i) => (
          <article
            key={b.id}
            aria-hidden={i !== actual}
            className={`relative flex min-h-64 w-full shrink-0 items-center bg-gradient-to-br ${b.fondo} px-6 py-10 text-white md:min-h-80 md:px-14`}
          >
            <div className="relative z-10 max-w-xl">
              <span className="inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-semibold tracking-wide backdrop-blur">
                {b.etiqueta}
              </span>
              <h2 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight md:text-5xl">
                {b.titulo}
              </h2>
              <p className="mt-3 text-base text-white/90 md:text-lg">{b.texto}</p>
              <Link
                href={b.href}
                tabIndex={i === actual ? 0 : -1}
                className="mt-6 inline-block rounded-full bg-white px-6 py-2.5 text-sm font-bold text-palacio-red shadow transition hover:scale-105"
              >
                {b.cta}
              </Link>
            </div>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-4 top-1/2 -translate-y-1/2 select-none text-[9rem] opacity-90 drop-shadow-lg md:right-12 md:text-[14rem]"
            >
              {b.emoji}
            </span>
          </article>
        ))}
      </div>

      {total > 1 ? (
        <>
          <button
            type="button"
            onClick={() => ir(actual - 1)}
            aria-label="Anterior"
            className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-xl text-zinc-900 shadow transition hover:bg-white md:flex"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => ir(actual + 1)}
            aria-label="Siguiente"
            className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-xl text-zinc-900 shadow transition hover:bg-white md:flex"
          >
            ›
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
            {banners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                onClick={() => ir(i)}
                aria-label={`Ir al banner ${i + 1}`}
                aria-current={i === actual}
                className={`h-2 rounded-full transition-all ${i === actual ? "w-6 bg-white" : "w-2 bg-white/50"}`}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
