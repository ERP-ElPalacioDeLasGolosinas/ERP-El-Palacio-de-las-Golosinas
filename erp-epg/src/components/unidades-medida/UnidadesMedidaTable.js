"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  eliminarUnidadMedida,
  habilitarUnidadMedida,
  inhabilitarUnidadMedida,
} from "@/lib/unidades-medida/actions";
import { UnidadMedidaFormModal } from "./UnidadMedidaFormModal";

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
 *   unidades: Array<{
 *     id_unidad_medida: string,
 *     nombre: string,
 *     abreviatura: string,
 *     activo: boolean,
 *     creado: string,
 *     editado: string,
 *     creado_por: string | null,
 *     creado_por_nombre?: string | null,
 *   }>,
 *   incluirInactivas: boolean,
 * }} props
 */
export function UnidadesMedidaTable({ unidades, incluirInactivas }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [busqueda, setBusqueda] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [enEdicion, setEnEdicion] = useState(null);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return unidades;
    return unidades.filter(
      (u) =>
        u.nombre.toLowerCase().includes(q) ||
        u.abreviatura.toLowerCase().includes(q)
    );
  }, [unidades, busqueda]);

  function toggleInactivas(checked) {
    const params = new URLSearchParams(searchParams);
    if (checked) {
      params.set("inactivas", "1");
    } else {
      params.delete("inactivas");
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function abrirAlta() {
    setEnEdicion(null);
    setModalAbierto(true);
  }

  function abrirEdicion(unidad) {
    setEnEdicion(unidad);
    setModalAbierto(true);
  }

  function toggleActivo(unidad) {
    startTransition(async () => {
      const result = unidad.activo
        ? await inhabilitarUnidadMedida(unidad.id_unidad_medida)
        : await habilitarUnidadMedida(unidad.id_unidad_medida);
      if (!result.ok) {
        window.alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  function eliminar(unidad) {
    const confirmado = window.confirm(
      `¿Eliminar la unidad de medida "${unidad.nombre}"? Esta acción no se puede deshacer.`
    );
    if (!confirmado) return;

    startTransition(async () => {
      const result = await eliminarUnidadMedida(unidad.id_unidad_medida);
      if (!result.ok) {
        window.alert(result.error);
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
            placeholder="Buscar por nombre o abreviatura"
            className="palacio-input max-w-xs"
          />
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={incluirInactivas}
              onChange={(e) => toggleInactivas(e.target.checked)}
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
          Nueva unidad
        </button>
      </div>

      {filtradas.length === 0 ? (
        <div className="palacio-card px-6 py-12 text-center">
          <p className="text-sm text-palacio-muted">
            {unidades.length === 0
              ? "No hay unidades de medida cargadas."
              : "Ninguna unidad coincide con la búsqueda."}
          </p>
        </div>
      ) : (
        <div className="palacio-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Listado</h2>
            <span className="text-xs text-palacio-muted">
              {filtradas.length} unidad{filtradas.length === 1 ? "" : "es"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-palacio-border bg-zinc-50/80">
                  <Th>Nombre</Th>
                  <Th>Abreviatura</Th>
                  <Th className="text-center">Estado</Th>
                  <Th>Creado</Th>
                  <Th>Editado</Th>
                  <Th>Creado por</Th>
                  <Th className="text-right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((u) => (
                  <tr
                    key={u.id_unidad_medida}
                    className={[
                      "border-b border-palacio-border last:border-0",
                      u.activo ? "" : "opacity-60",
                    ].join(" ")}
                  >
                    <td className="px-5 py-4 align-middle font-medium text-zinc-900">
                      {u.nombre}
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <span className="font-mono text-xs tracking-wider text-zinc-700 uppercase">
                        {u.abreviatura}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center align-middle">
                      <span
                        className={
                          u.activo
                            ? "palacio-badge-activo"
                            : "palacio-badge-inactivo"
                        }
                      >
                        {u.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {formatFecha(u.creado)}
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {formatFecha(u.editado)}
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {u.creado_por_nombre ??
                        (u.creado_por ? `${u.creado_por.slice(0, 8)}…` : "—")}
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => abrirEdicion(u)}
                          className="palacio-action-btn palacio-action-primary"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => toggleActivo(u)}
                          className="palacio-action-btn"
                        >
                          {u.activo ? "Inhabilitar" : "Habilitar"}
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => eliminar(u)}
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
        <UnidadMedidaFormModal
          key={enEdicion?.id_unidad_medida ?? "nuevo"}
          onClose={() => setModalAbierto(false)}
          unidad={enEdicion}
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
