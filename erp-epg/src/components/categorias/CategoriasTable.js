"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  eliminarCategoria,
  setActivoCategoria,
} from "@/lib/categorias/actions";

/**
 * @param {{
 *   categorias: Array<{
 *     id_categoria: string,
 *     id_rubro: string,
 *     nombre_categoria: string,
 *     activo: boolean,
 *     creado: string,
 *     editado: string,
 *     rubro?: { id_rubro: string, nombre_rubro: string, activo: boolean } | null,
 *   }>,
 * }} props
 */
export function CategoriasTable({ categorias }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggleActivo(id, activoActual) {
    startTransition(async () => {
      const result = await setActivoCategoria(id, !activoActual);
      if (result.error) {
        window.alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  function onEliminar(id, nombre) {
    const ok = window.confirm(
      `¿Eliminar la categoría "${nombre}"?\n\nSolo se permite si no tiene artículos asociados. Si preferís conservarla, usá Inhabilitar.`
    );
    if (!ok) return;

    startTransition(async () => {
      const result = await eliminarCategoria(id);
      if (result.error) {
        window.alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (!categorias.length) {
    return (
      <div className="card px-6 py-12 text-center">
        <p className="text-sm text-ink-muted">
          No hay categorías cargadas.{" "}
          <Link
            href="/categorias/nuevo"
            className="font-medium text-primary underline underline-offset-2"
          >
            Crear la primera
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold text-zinc-900">Listado</h2>
        <span className="text-xs text-ink-muted">
          {categorias.length}{" "}
          {categorias.length === 1 ? "categoría" : "categorías"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-zinc-50/80">
              <th className="px-5 py-3 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
                Nombre
              </th>
              <th className="px-5 py-3 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
                Rubro
              </th>
              <th className="px-5 py-3 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
                Estado
              </th>
              <th className="px-5 py-3 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {categorias.map((c) => (
              <tr
                key={c.id_categoria}
                className="border-b border-border last:border-0"
              >
                <td className="px-5 py-3.5">
                  <p className="font-semibold text-zinc-900">
                    {c.nombre_categoria}
                  </p>
                  <p className="text-xs text-ink-muted">
                    ID · {c.id_categoria.slice(0, 8)}…
                  </p>
                </td>
                <td className="px-5 py-3.5">
                  <p className="text-zinc-800">
                    {c.rubro?.nombre_rubro ?? "—"}
                  </p>
                </td>
                <td className="px-5 py-3.5">
                  <span
                    className={
                      c.activo
                        ? "inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700"
                        : "inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-600"
                    }
                  >
                    {c.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      href={`/categorias/${c.id_categoria}/editar`}
                      className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                    >
                      Editar
                    </Link>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => toggleActivo(c.id_categoria, c.activo)}
                      className="text-sm font-medium text-zinc-600 underline-offset-2 hover:underline disabled:opacity-50"
                    >
                      {c.activo ? "Inhabilitar" : "Reactivar"}
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        onEliminar(c.id_categoria, c.nombre_categoria)
                      }
                      className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-2 hover:underline disabled:opacity-50"
                      title="Eliminar categoría"
                    >
                      <TrashIcon />
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
  );
}

function TrashIcon() {
  return (
    <svg
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 6h18M8 6V4h8v2m-1 0v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6h10Z"
      />
    </svg>
  );
}
