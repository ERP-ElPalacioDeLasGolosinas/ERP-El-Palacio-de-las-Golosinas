"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setActivoDeposito } from "@/lib/depositos/actions";

/**
 * @param {{ depositos: Array<{ id_deposito: string, nombre_deposito: string, direccion_deposito: string | null, activo: boolean, creado: string, editado: string }> }} props
 */
export function DepositosTable({ depositos }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggleActivo(id, activoActual) {
    startTransition(async () => {
      const result = await setActivoDeposito(id, !activoActual);
      if (result.error) {
        window.alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (!depositos.length) {
    return (
      <div className="palacio-card px-6 py-12 text-center">
        <p className="text-sm text-palacio-muted">
          No hay depósitos cargados.{" "}
          <Link
            href="/depositos/nuevo"
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
          {depositos.length} depósito{depositos.length === 1 ? "" : "s"}
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
                Dirección
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
            {depositos.map((d) => (
              <tr
                key={d.id_deposito}
                className="border-b border-palacio-border last:border-0"
              >
                <td className="px-5 py-3.5">
                  <p className="font-semibold text-zinc-900">
                    {d.nombre_deposito}
                  </p>
                  <p className="text-xs text-palacio-muted">
                    ID · {d.id_deposito.slice(0, 8)}…
                  </p>
                </td>
                <td className="px-5 py-3.5 text-palacio-muted">
                  {d.direccion_deposito || "Sin dirección"}
                </td>
                <td className="px-5 py-3.5">
                  <span
                    className={
                      d.activo
                        ? "palacio-badge-activo"
                        : "palacio-badge-inactivo"
                    }
                  >
                    {d.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      href={`/depositos/${d.id_deposito}/editar`}
                      className="text-sm font-medium text-palacio-red underline-offset-2 hover:underline"
                    >
                      Editar
                    </Link>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => toggleActivo(d.id_deposito, d.activo)}
                      className="text-sm font-medium text-zinc-600 underline-offset-2 hover:underline disabled:opacity-50"
                    >
                      {d.activo ? "Desactivar" : "Activar"}
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
