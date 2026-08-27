"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  eliminarRubro,
  habilitarRubro,
  inhabilitarRubro,
  motivoBloqueoEliminarRubro,
} from "@/lib/rubros/actions";
import { RubroFormModal } from "./RubroFormModal";

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
 *   rubros: Array<{
 *     id_rubro: string,
 *     nombre_rubro: string,
 *     activo: boolean,
 *     creado: string,
 *     editado: string | null,
 *     creado_por: string | null,
 *     creado_por_nombre: string | null,
 *   }>,
 *   incluirInactivos: boolean,
 * }} props
 */
export function RubrosTable({ rubros, incluirInactivos }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [busqueda, setBusqueda] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [enEdicion, setEnEdicion] = useState(null);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return rubros;
    return rubros.filter((r) => r.nombre_rubro.toLowerCase().includes(q));
  }, [rubros, busqueda]);

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

  function abrirEdicion(rubro) {
    setEnEdicion(rubro);
    setModalAbierto(true);
  }

  function toggleActivo(rubro) {
    startTransition(async () => {
      const result = rubro.activo
        ? await inhabilitarRubro(rubro.id_rubro)
        : await habilitarRubro(rubro.id_rubro);
      if (!result.ok) {
        window.alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  function eliminar(rubro) {
    startTransition(async () => {
      const { motivo, error } = await motivoBloqueoEliminarRubro(rubro.id_rubro);
      if (error) {
        window.alert(error);
        return;
      }
      if (motivo) {
        window.alert(`${motivo}\n\nPodés inhabilitarlo en su lugar.`);
        return;
      }

      const confirmado = window.confirm(
        `¿Eliminar el rubro "${rubro.nombre_rubro}"? Esta acción no se puede deshacer.`
      );
      if (!confirmado) return;

      const result = await eliminarRubro(rubro.id_rubro);
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
            placeholder="Buscar por nombre"
            className="palacio-input max-w-xs"
          />
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={incluirInactivos}
              onChange={(e) => toggleInactivos(e.target.checked)}
              className="size-4 accent-palacio-red"
            />
            Incluir inactivos
          </label>
        </div>
        <button
          type="button"
          onClick={abrirAlta}
          className="palacio-btn-primary inline-flex px-4 py-2.5 text-sm"
        >
          Nuevo rubro
        </button>
      </div>

      {filtrados.length === 0 ? (
        <div className="palacio-card px-6 py-12 text-center">
          <p className="text-sm text-palacio-muted">
            {rubros.length === 0
              ? "No hay rubros cargados."
              : "Ningún rubro coincide con la búsqueda."}
          </p>
        </div>
      ) : (
        <div className="palacio-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Listado</h2>
            <span className="text-xs text-palacio-muted">
              {filtrados.length} rubro{filtrados.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-palacio-border bg-zinc-50/80">
                  <Th>Nombre</Th>
                  <Th className="text-center">Estado</Th>
                  <Th>Creado</Th>
                  <Th>Editado</Th>
                  <Th>Creado por</Th>
                  <Th className="text-right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((r) => (
                  <tr
                    key={r.id_rubro}
                    className={[
                      "border-b border-palacio-border last:border-0",
                      r.activo ? "" : "opacity-60",
                    ].join(" ")}
                  >
                    <td className="px-5 py-4 align-middle font-medium text-zinc-900">
                      {r.nombre_rubro}
                    </td>
                    <td className="px-5 py-4 text-center align-middle">
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
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {formatFecha(r.creado)}
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {formatFecha(r.editado)}
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {r.creado_por_nombre ??
                        (r.creado_por ? `${r.creado_por.slice(0, 8)}…` : "—")}
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => abrirEdicion(r)}
                          className="palacio-action-btn palacio-action-primary"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => toggleActivo(r)}
                          className="palacio-action-btn"
                        >
                          {r.activo ? "Inhabilitar" : "Habilitar"}
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => eliminar(r)}
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
        <RubroFormModal
          key={enEdicion?.id_rubro ?? "nuevo"}
          onClose={() => setModalAbierto(false)}
          rubro={enEdicion}
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
