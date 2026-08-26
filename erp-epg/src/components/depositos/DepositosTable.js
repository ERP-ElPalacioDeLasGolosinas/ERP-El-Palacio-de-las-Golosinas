"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  eliminarDeposito,
  setActivoDeposito,
  setEstaLlenoDeposito,
} from "@/lib/depositos/actions";

/**
 * @param {{ depositos: Array<{
 *   id_deposito: string,
 *   nombre_deposito: string,
 *   direccion_deposito: string | null,
 *   telefono_deposito: string | null,
 *   horario_apertura: string | null,
 *   horario_cierre: string | null,
 *   id_responsable: string | null,
 *   activo: boolean,
 *   esta_lleno: boolean,
 * }> }} props
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

  function toggleEstaLleno(id, estaLlenoActual) {
    startTransition(async () => {
      const result = await setEstaLlenoDeposito(id, !estaLlenoActual);
      if (result.error) {
        window.alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  function eliminar(id, nombre) {
    const confirmado = window.confirm(
      `¿Eliminar el depósito "${nombre}"? Esta acción no se puede deshacer.`
    );

    if (!confirmado) {
      return;
    }

    startTransition(async () => {
      const result = await eliminarDeposito(id);
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
            href="/deposito/nuevo"
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
              <th className="px-5 py-3 text-left text-[11px] font-semibold tracking-wider text-palacio-muted uppercase">
                Nombre
              </th>
              <th className="px-5 py-3 text-left text-[11px] font-semibold tracking-wider text-palacio-muted uppercase">
                Contacto
              </th>
              <th className="px-5 py-3 text-center text-[11px] font-semibold tracking-wider text-palacio-muted uppercase">
                Horario
              </th>
              <th className="px-5 py-3 text-center text-[11px] font-semibold tracking-wider text-palacio-muted uppercase">
                Estado
              </th>
              <th className="px-5 py-3 text-center text-[11px] font-semibold tracking-wider text-palacio-muted uppercase">
                Capacidad
              </th>
              <th className="px-5 py-3 text-right text-[11px] font-semibold tracking-wider text-palacio-muted uppercase">
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
                <td className="px-5 py-4 align-middle">
                  <p className="font-semibold text-zinc-900">
                    {d.nombre_deposito}
                  </p>
                  <p className="text-xs text-palacio-muted">
                    {d.direccion_deposito || "Sin dirección"}
                  </p>
                </td>
                <td className="px-5 py-4 align-middle text-palacio-muted">
                  <p>{d.telefono_deposito || "Sin teléfono"}</p>
                  {d.id_responsable ? (
                    <p className="text-xs">
                      Resp. {d.id_responsable.slice(0, 8)}…
                    </p>
                  ) : null}
                </td>
                <td className="px-5 py-4 text-center align-middle text-palacio-muted">
                  {formatHorario(d.horario_apertura, d.horario_cierre)}
                </td>
                <td className="px-5 py-4 text-center align-middle">
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
                <td className="px-5 py-4 text-center align-middle">
                  <span
                    className={
                      d.esta_lleno
                        ? "palacio-badge-lleno"
                        : "palacio-badge-disponible"
                    }
                  >
                    {d.esta_lleno ? "Lleno" : "Disponible"}
                  </span>
                </td>
                <td className="px-5 py-4 align-middle">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Link
                      href={`/deposito/${d.id_deposito}/editar`}
                      className="palacio-action-btn palacio-action-primary"
                    >
                      Editar
                    </Link>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => toggleActivo(d.id_deposito, d.activo)}
                      className="palacio-action-btn"
                    >
                      {d.activo ? "Desactivar" : "Activar"}
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        toggleEstaLleno(d.id_deposito, d.esta_lleno)
                      }
                      className="palacio-action-btn"
                    >
                      {d.esta_lleno ? "Marcar disponible" : "Marcar lleno"}
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => eliminar(d.id_deposito, d.nombre_deposito)}
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
  );
}

function formatHorario(apertura, cierre) {
  if (!apertura && !cierre) {
    return "Sin horario";
  }

  const desde = apertura ? String(apertura).slice(0, 5) : "--:--";
  const hasta = cierre ? String(cierre).slice(0, 5) : "--:--";
  return `${desde} a ${hasta}`;
}
