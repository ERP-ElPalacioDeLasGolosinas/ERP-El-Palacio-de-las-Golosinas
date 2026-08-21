"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { eliminarRubro, setActivoRubro } from "@/lib/rubros/actions";

/**
 * @param {{ rubros: Array<{ id_rubro: string, nombre_rubro: string, activo: boolean, creado: string, editado: string }> }} props
 */
export function RubrosTable({ rubros }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggleActivo(id, activoActual) {
    startTransition(async () => {
      const result = await setActivoRubro(id, !activoActual);
      if (result.error) {
        window.alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  function onEliminar(id, nombre) {
    const ok = window.confirm(
      `¿Eliminar el rubro "${nombre}"?\n\nSolo se permite si no tiene artículos activos asociados. Si preferís conservarlo, usá Inhabilitar.`
    );
    if (!ok) return;

    startTransition(async () => {
      const result = await eliminarRubro(id);
      if (result.error) {
        window.alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (!rubros.length) {
    return (
      <div className="palacio-card px-6 py-12 text-center">
        <p className="text-sm text-palacio-muted">
          No hay rubros cargados.{" "}
          <Link
            href="/rubros/nuevo"
            className="font-medium text-palacio-red underline underline-offset-2"
          >
            Crear el primero
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="palacio-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
        <h2 className="text-sm font-semibold text-zinc-900">Listado</h2>
        <span className="text-xs text-palacio-muted">
          {rubros.length} rubro{rubros.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-palacio-border bg-zinc-50/80">
              <th className="px-5 py-3 text-[11px] font-semibold tracking-wider text-palacio-muted uppercase">
                Nombre
              </th>
              <th className="px-5 py-3 text-[11px] font-semibold tracking-wider text-palacio-muted uppercase">
                Estado
              </th>
              <th className="px-5 py-3 text-[11px] font-semibold tracking-wider text-palacio-muted uppercase">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {rubros.map((r) => (
              <tr
                key={r.id_rubro}
                className="border-b border-palacio-border last:border-0"
              >
                <td className="px-5 py-3.5">
                  <p className="font-semibold text-zinc-900">
                    {r.nombre_rubro}
                  </p>
                  <p className="text-xs text-palacio-muted">
                    ID · {r.id_rubro.slice(0, 8)}…
                  </p>
                </td>
                <td className="px-5 py-3.5">
                  <span
                    className={
                      r.activo
                        ? "palacio-badge-activo"
                        : "palacio-badge-inactivo"
                    }
                  >
                    {r.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      href={`/rubros/${r.id_rubro}/editar`}
                      className="text-sm font-medium text-palacio-red underline-offset-2 hover:underline"
                    >
                      Editar
                    </Link>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => toggleActivo(r.id_rubro, r.activo)}
                      className="text-sm font-medium text-zinc-600 underline-offset-2 hover:underline disabled:opacity-50"
                    >
                      {r.activo ? "Inhabilitar" : "Reactivar"}
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => onEliminar(r.id_rubro, r.nombre_rubro)}
                      className="inline-flex items-center gap-1 text-sm font-medium text-palacio-red underline-offset-2 hover:underline disabled:opacity-50"
                      title="Eliminar rubro"
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
