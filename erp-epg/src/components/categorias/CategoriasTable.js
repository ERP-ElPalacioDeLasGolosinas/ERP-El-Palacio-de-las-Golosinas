"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  eliminarCategoria,
  habilitarCategoria,
  inhabilitarCategoria,
  motivoBloqueoEliminarCategoria,
} from "@/lib/categorias/actions";
import { CategoriaFormModal } from "./CategoriaFormModal";

const fechaFmt = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatFecha(valor) {
  if (!valor) return "—";
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? "—" : fechaFmt.format(d);
}

/**
 * @param {{
 *   categorias: Array<{
 *     id_categoria: string,
 *     nombre_categoria: string,
 *     activo: boolean,
 *     id_rubro: string,
 *     nombre_rubro: string,
 *     creado: string,
 *     editado: string | null,
 *     creado_por: string | null,
 *     creado_por_nombre: string | null,
 *   }>,
 *   rubros: Array<{ id_rubro: string, nombre_rubro: string }>,
 *   incluirInactivos: boolean,
 * }} props
 */
export function CategoriasTable({ categorias, rubros, incluirInactivos }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [busqueda, setBusqueda] = useState("");
  const [filtroRubro, setFiltroRubro] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [enEdicion, setEnEdicion] = useState(null);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return categorias.filter((c) => {
      if (filtroRubro && c.id_rubro !== filtroRubro) return false;
      if (q && !c.nombre_categoria.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [categorias, busqueda, filtroRubro]);

  function toggleInactivos(checked) {
    const params = new URLSearchParams(searchParams);
    if (checked) {
      params.set("inactivos", "1");
    } else {
      params.delete("inactivos");
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function abrirAlta() {
    setEnEdicion(null);
    setModalAbierto(true);
  }

  function abrirEdicion(categoria) {
    setEnEdicion(categoria);
    setModalAbierto(true);
  }

  function manejarErrorAccion(result) {
    window.alert(result.error);
    if (result.code === "CAT03") router.refresh();
  }

  function toggleActivo(categoria) {
    startTransition(async () => {
      const result = categoria.activo
        ? await inhabilitarCategoria(categoria.id_categoria)
        : await habilitarCategoria(categoria.id_categoria);
      if (!result.ok) {
        manejarErrorAccion(result);
        return;
      }
      router.refresh();
    });
  }

  function eliminar(categoria) {
    startTransition(async () => {
      const { motivo, error } = await motivoBloqueoEliminarCategoria(
        categoria.id_categoria
      );
      if (error) {
        window.alert(error);
        return;
      }
      if (motivo) {
        window.alert(`${motivo}\n\nPodés inhabilitarla en su lugar.`);
        return;
      }

      const confirmado = window.confirm(
        `¿Eliminar la categoría "${categoria.nombre_categoria}"? Esta acción no se puede deshacer.`
      );
      if (!confirmado) return;

      const result = await eliminarCategoria(categoria.id_categoria);
      if (!result.ok) {
        manejarErrorAccion(result);
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre"
            className="palacio-input max-w-xs"
          />
          <select
            value={filtroRubro}
            onChange={(e) => setFiltroRubro(e.target.value)}
            className="palacio-input max-w-xs"
            aria-label="Filtrar por rubro"
          >
            <option value="">Todos los rubros</option>
            {rubros.map((r) => (
              <option key={r.id_rubro} value={r.id_rubro}>
                {r.nombre_rubro}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={incluirInactivos}
              onChange={(e) => toggleInactivos(e.target.checked)}
              className="size-4 accent-palacio-red"
            />
            Incluir inactivas
          </label>
        </div>
        <button
          type="button"
          onClick={abrirAlta}
          className="palacio-btn-primary inline-flex px-4 py-2.5 text-sm"
        >
          Nueva categoría
        </button>
      </div>

      {filtradas.length === 0 ? (
        <div className="palacio-card px-6 py-12 text-center">
          <p className="text-sm text-palacio-muted">
            {categorias.length === 0
              ? "No hay categorías cargadas."
              : "Ninguna categoría coincide con los filtros."}
          </p>
        </div>
      ) : (
        <div className="palacio-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Listado</h2>
            <span className="text-xs text-palacio-muted">
              {filtradas.length} categoría{filtradas.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-palacio-border bg-zinc-50/80">
                  <Th>Nombre</Th>
                  <Th className="text-center">Estado</Th>
                  <Th>Rubro asociado</Th>
                  <Th>Creado</Th>
                  <Th>Editado</Th>
                  <Th>Creado por</Th>
                  <Th className="text-right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((c) => (
                  <tr
                    key={c.id_categoria}
                    className={[
                      "border-b border-palacio-border last:border-0",
                      c.activo ? "" : "opacity-60",
                    ].join(" ")}
                  >
                    <td className="px-5 py-4 align-middle font-medium text-zinc-900">
                      {c.nombre_categoria}
                    </td>
                    <td className="px-5 py-4 text-center align-middle">
                      <span
                        className={
                          c.activo
                            ? "palacio-badge-activo"
                            : "palacio-badge-inactivo"
                        }
                      >
                        {c.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-middle text-zinc-700">
                      {c.nombre_rubro}
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {formatFecha(c.creado)}
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {formatFecha(c.editado)}
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {c.creado_por_nombre ??
                        (c.creado_por ? `${c.creado_por.slice(0, 8)}…` : "—")}
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => abrirEdicion(c)}
                          className="palacio-action-btn palacio-action-primary"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => toggleActivo(c)}
                          className="palacio-action-btn"
                        >
                          {c.activo ? "Inhabilitar" : "Habilitar"}
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => eliminar(c)}
                          className="palacio-action-btn palacio-action-danger"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalAbierto ? (
        <CategoriaFormModal
          key={enEdicion?.id_categoria ?? "nueva"}
          onClose={() => setModalAbierto(false)}
          categoria={enEdicion}
          rubros={rubros}
        />
      ) : null}
    </>
  );
}

function Th({ children, className = "" }) {
  return (
    <th
      className={`px-5 py-3 text-[11px] font-semibold tracking-wider text-palacio-muted uppercase ${className}`}
    >
      {children}
    </th>
  );
}
