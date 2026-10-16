"use client";

import Link from "next/link";
import { useRef } from "react";

function Campo({ name, etiqueta, opciones, valor, alCambiar }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-palacio-muted">
      {etiqueta}
      <select
        name={name}
        defaultValue={valor ?? ""}
        onChange={alCambiar}
        className="palacio-input text-sm font-normal normal-case tracking-normal text-zinc-900"
      >
        <option value="">Todas</option>
        {opciones.map((o) => (
          <option key={o.id} value={o.id}>{o.nombre}</option>
        ))}
      </select>
    </label>
  );
}

// Filtros del catálogo: se aplican solos al cambiar cada campo (sin botón).
export default function FiltrosTienda({ action, filtros, valores, hayFiltros }) {
  const form = useRef(null);
  const aplicar = () => form.current?.requestSubmit();

  return (
    <form
      ref={form}
      method="get"
      action={action}
      className="palacio-card flex flex-col gap-4 p-4 lg:sticky lg:top-24"
      aria-label="Filtros"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-extrabold tracking-tight">Filtrar</h2>
        {hayFiltros ? (
          <Link href={action ?? "?"} className="text-xs font-semibold text-palacio-red hover:underline">Limpiar</Link>
        ) : null}
      </div>

      <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-palacio-muted">
        Buscar
        <input
          type="search"
          name="q"
          defaultValue={valores.q}
          placeholder="Producto o marca"
          className="palacio-input text-sm font-normal normal-case tracking-normal text-zinc-900"
        />
      </label>

      <Campo name="categoria" etiqueta="Categoría" opciones={filtros.categorias} valor={valores.categoria} alCambiar={aplicar} />
      <Campo name="rubro" etiqueta="Rubro" opciones={filtros.rubros} valor={valores.rubro} alCambiar={aplicar} />
      <Campo name="marca" etiqueta="Marca" opciones={filtros.marcas} valor={valores.marca} alCambiar={aplicar} />

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="ofertas"
          value="1"
          defaultChecked={valores.ofertas}
          onChange={aplicar}
          className="size-4 accent-palacio-red"
        />
        Solo ofertas
      </label>

      <button type="submit" className="palacio-btn-primary px-4 py-2 text-sm">Buscar</button>
    </form>
  );
}
