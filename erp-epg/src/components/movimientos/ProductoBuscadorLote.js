"use client";

import { useEffect, useState } from "react";
import { buscarProductosParaLote } from "@/lib/movimientos/actions";

/**
 * Buscador de producto por código o nombre. No carga el catálogo entero:
 * consulta a partir de dos caracteres. Si `producto` viene elegido, muestra
 * ese artículo y deja cambiarlo.
 *
 * @param {{
 *   onSeleccionar: (producto: Record<string, unknown>) => void,
 *   onQuitar?: () => void,
 *   producto?: { id_producto?: string, codigo_producto?: string | null, nombre_completo?: string | null } | null,
 *   disabled?: boolean,
 *   etiqueta?: string | null,
 * }} props
 */
export function ProductoBuscadorLote({
  onSeleccionar,
  onQuitar,
  producto = null,
  disabled,
  etiqueta = "Buscar producto",
}) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);

  // Fetch con debounce solo cuando hay al menos 2 caracteres. El limpiado para
  // queries cortas se hace en el onChange, no acá, para no llamar setState de
  // forma síncrona dentro del efecto.
  useEffect(() => {
    if (query.trim().length < 2) return;
    let vigente = true;
    const t = setTimeout(async () => {
      setCargando(true);
      const { data, error } = await buscarProductosParaLote(query.trim());
      if (!vigente) return;
      setCargando(false);
      if (!error) {
        setResultados(data ?? []);
        setAbierto(true);
      }
    }, 300);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [query]);

  function onQueryChange(valor) {
    setQuery(valor);
    if (valor.trim().length < 2) {
      setResultados([]);
      setAbierto(false);
    }
  }

  function seleccionar(producto) {
    onSeleccionar(producto);
    setQuery("");
    setResultados([]);
    setAbierto(false);
  }

  if (producto?.id_producto) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-palacio-border bg-zinc-50 px-3 py-2">
        <span className="min-w-0 text-sm text-zinc-900">
          {producto.codigo_producto ? (
            <span className="font-medium">{producto.codigo_producto}</span>
          ) : null}
          {producto.codigo_producto ? " — " : null}
          {producto.nombre_completo}
        </span>
        {onQuitar ? (
          <button
            type="button"
            onClick={onQuitar}
            disabled={disabled}
            className="shrink-0 text-xs font-medium text-palacio-muted hover:text-zinc-900"
          >
            Cambiar
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative">
      {etiqueta ? (
        <label className="text-sm font-medium text-zinc-800">
          {etiqueta} <span className="text-palacio-red">*</span>
        </label>
      ) : null}
      <input
        type="text"
        value={query}
        disabled={disabled}
        onChange={(e) => onQueryChange(e.target.value)}
        onFocus={() => resultados.length > 0 && setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
        placeholder="Código de barra o nombre del producto…"
        className={etiqueta ? "palacio-input mt-1.5" : "palacio-input"}
      />
      {abierto && resultados.length > 0 ? (
        <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border border-palacio-border bg-white shadow-lg">
          {resultados.map((p) => (
            <li key={p.id_producto}>
              <button
                type="button"
                onMouseDown={() => seleccionar(p)}
                className="w-full border-b border-palacio-border px-4 py-2.5 text-left last:border-0 hover:bg-zinc-50"
              >
                <span className="font-medium">{p.codigo_producto}</span> —{" "}
                {p.nombre_completo}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {abierto &&
      !cargando &&
      query.trim().length >= 2 &&
      resultados.length === 0 ? (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-palacio-border bg-white px-4 py-2.5 text-sm text-palacio-muted shadow-lg">
          Sin coincidencias.
        </div>
      ) : null}
    </div>
  );
}
