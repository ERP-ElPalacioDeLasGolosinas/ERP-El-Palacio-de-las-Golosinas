"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  habilitarTipoMovimiento,
  inhabilitarTipoMovimiento,
} from "@/lib/tipos-movimiento/actions";
import { TipoMovimientoFormModal } from "./TipoMovimientoFormModal";

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
 *   tiposMovimiento: Array<{
 *     id_tipo_movimiento: string,
 *     nombre: string,
 *     signo: number,
 *     requiere_control_stock: boolean,
 *     activo: boolean,
 *     creado: string,
 *     editado: string,
 *     creado_por: string | null,
 *   }>,
 *   incluirInactivas: boolean,
 * }} props
 */
export function TiposMovimientoTable({ tiposMovimiento, incluirInactivas }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [busqueda, setBusqueda] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [enEdicion, setEnEdicion] = useState(null);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return tiposMovimiento;
    return tiposMovimiento.filter((t) => t.nombre.toLowerCase().includes(q));
  }, [tiposMovimiento, busqueda]);

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

  function abrirEdicion(tipo) {
    setEnEdicion(tipo);
    setModalAbierto(true);
  }

  function manejarErrorAccion(result) {
    window.alert(result.error);
    if (result.code === "TMV03") router.refresh();
  }

  function toggleActivo(tipo) {
    startTransition(async () => {
      const result = tipo.activo
        ? await inhabilitarTipoMovimiento(tipo.id_tipo_movimiento)
        : await habilitarTipoMovimiento(tipo.id_tipo_movimiento);
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
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={incluirInactivas}
              onChange={(e) => toggleInactivas(e.target.checked)}
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
          Nuevo tipo de movimiento
        </button>
      </div>

      {filtrados.length === 0 ? (
        <div className="palacio-card px-6 py-12 text-center">
          <p className="text-sm text-palacio-muted">
            {tiposMovimiento.length === 0
              ? "No hay tipos de movimiento cargados."
              : "Ningún tipo de movimiento coincide con la búsqueda."}
          </p>
        </div>
      ) : (
        <div className="palacio-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Listado</h2>
            <span className="text-xs text-palacio-muted">
              {filtrados.length} tipo{filtrados.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-palacio-border bg-zinc-50/80">
                  <Th>Nombre</Th>
                  <Th className="text-center">Signo</Th>
                  <Th className="text-center">Control de stock</Th>
                  <Th className="text-center">Estado</Th>
                  <Th>Creado</Th>
                  <Th>Editado</Th>
                  <Th>Creado por</Th>
                  <Th className="text-right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((t) => (
                  <tr
                    key={t.id_tipo_movimiento}
                    className={[
                      "border-b border-palacio-border last:border-0",
                      t.activo ? "" : "opacity-60",
                    ].join(" ")}
                  >
                    <td className="px-5 py-4 align-middle font-medium text-zinc-900">
                      {t.nombre}
                    </td>
                    <td className="px-5 py-4 text-center align-middle">
                      {t.signo === 1 ? (
                        <span className="palacio-badge-activo">Entrada</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                          Salida
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center align-middle text-palacio-muted">
                      {t.requiere_control_stock ? "Sí" : "No"}
                    </td>
                    <td className="px-5 py-4 text-center align-middle">
                      <span
                        className={
                          t.activo
                            ? "palacio-badge-activo"
                            : "palacio-badge-inactivo"
                        }
                      >
                        {t.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {formatFecha(t.creado)}
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {formatFecha(t.editado)}
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {t.creado_por ? `${t.creado_por.slice(0, 8)}…` : "—"}
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => abrirEdicion(t)}
                          className="palacio-action-btn palacio-action-primary"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => toggleActivo(t)}
                          className="palacio-action-btn"
                        >
                          {t.activo ? "Inhabilitar" : "Habilitar"}
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
        <TipoMovimientoFormModal
          key={enEdicion?.id_tipo_movimiento ?? "nuevo"}
          onClose={() => setModalAbierto(false)}
          tipoMovimiento={enEdicion}
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
