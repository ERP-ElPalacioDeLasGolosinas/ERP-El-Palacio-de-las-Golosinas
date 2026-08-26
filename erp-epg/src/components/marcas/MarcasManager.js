"use client";

import { useActionState, useState } from "react";
import { crearMarca } from "@/app/(dashboard)/marcas/actions";
import MarcaRow from "./MarcaRow";

const ESTADO_INICIAL = { ok: false, error: null };

export default function MarcasManager({ marcas }) {
  // Input controlado: React 19 resetea los campos no controlados de un
  // <form action> al terminar la action AUNQUE haya fallado; controlándolo,
  // sólo se limpia cuando el alta salió bien.
  const [nombre, setNombre] = useState("");
  const [query, setQuery] = useState("");

  const [createState, createAction, creating] = useActionState(
    async (prev, formData) => {
      const resultado = await crearMarca(prev, formData);
      if (resultado.ok) setNombre("");
      return resultado;
    },
    ESTADO_INICIAL
  );

  const q = query.trim().toLowerCase();
  const filtradas = q
    ? marcas.filter((m) => m.nombre_marca.toLowerCase().includes(q))
    : marcas;

  return (
    <>
      <section className="card overflow-hidden">
        <div className="flex items-center gap-3 border-b border-linea px-4 py-3.5">
          <h3 className="text-[13.5px] font-bold">Listado de marcas</h3>
          <div className="ml-auto flex items-center gap-2 rounded-[9px] border border-linea bg-panel px-3 py-1.5 focus-within:border-oro focus-within:ring-2 focus-within:ring-ambar-bg">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-4 w-4 text-tinta-suave"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar marca…"
              className="w-44 bg-transparent text-[13px] outline-none placeholder:text-tinta-suave/60"
              aria-label="Buscar marca"
            />
          </div>
          <span className="text-[11.5px] text-tinta-suave tabular-nums">
            {q
              ? `${filtradas.length} de ${marcas.length}`
              : `${marcas.length} ${marcas.length === 1 ? "marca" : "marcas"}`}
          </span>
        </div>

        {/* Alta inline */}
        <div className="border-b border-linea bg-crema/50 px-4 py-3.5">
          <form action={createAction} className="flex items-center gap-2.5">
            <input
              type="text"
              name="nombre_marca"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre de la nueva marca (ej.: Arcor)"
              maxLength={60}
              required
              disabled={creating}
              className="min-w-0 flex-1 rounded-[9px] border-[1.5px] border-linea bg-panel px-3 py-2 text-sm outline-none placeholder:text-tinta-suave/60 focus:border-oro focus:ring-2 focus:ring-ambar-bg disabled:opacity-60"
              aria-label="Nombre de la nueva marca"
            />
            <button type="submit" className="btn-primary" disabled={creating}>
              {creating ? "Agregando…" : "+ Agregar"}
            </button>
          </form>
          {createState.error && (
            <p className="mt-2 text-[13px] font-medium text-rojo" role="alert">
              {createState.error}
            </p>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                <th className="px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.6px] text-tinta-suave">
                  Nombre
                </th>
                <th className="px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.6px] text-tinta-suave">
                  Estado
                </th>
                <th className="px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.6px] text-tinta-suave">
                  Creada
                </th>
                <th className="px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.6px] text-tinta-suave">
                  Creada por
                </th>
                <th className="px-4 py-2.5 text-right text-[10.5px] font-bold uppercase tracking-[0.6px] text-tinta-suave">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((marca) => (
                <MarcaRow key={marca.id_marca} marca={marca} />
              ))}

              {filtradas.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="border-t border-linea px-4 py-10 text-center text-sm text-tinta-suave"
                  >
                    {marcas.length > 0 ? (
                      <>Sin resultados para «{query.trim()}».</>
                    ) : (
                      <>
                        Todavía no hay marcas. Creá la primera con el formulario
                        de arriba.
                      </>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
