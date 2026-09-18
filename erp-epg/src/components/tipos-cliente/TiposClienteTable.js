"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  habilitarTipoCliente,
  inhabilitarTipoCliente,
} from "@/lib/tipos-cliente/actions";
import { TipoClienteFormModal } from "./TipoClienteFormModal";

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
 *   tipos: Array<{
 *     id_tipo_cliente: string,
 *     nombre_tipo_cliente: string,
 *     lista_precio: string,
 *     activo: boolean,
 *     creado: string,
 *     editado: string,
 *     creado_por: string | null,
 *     creado_por_nombre?: string | null,
 *     cantidad_clientes: number,
 *   }>,
 *   incluirInactivos: boolean,
 * }} props
 */
export function TiposClienteTable({ tipos, incluirInactivos }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [modalAbierto, setModalAbierto] = useState(false);
  const [enEdicion, setEnEdicion] = useState(null);

  function toggleInactivos(checked) {
    const params = new URLSearchParams(searchParams);
    if (checked) params.set("inactivos", "1");
    else params.delete("inactivos");
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
    if (result.code === "TCL04") router.refresh();
  }

  function toggleActivo(tipo) {
    startTransition(async () => {
      const result = tipo.activo
        ? await inhabilitarTipoCliente(tipo.id_tipo_cliente)
        : await habilitarTipoCliente(tipo.id_tipo_cliente);
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
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={incluirInactivos}
            onChange={(e) => toggleInactivos(e.target.checked)}
            className="size-4 accent-palacio-red"
          />
          Incluir inactivos
        </label>
        <button
          type="button"
          onClick={abrirAlta}
          className="palacio-btn-primary inline-flex px-4 py-2.5 text-sm"
        >
          Nuevo tipo de cliente
        </button>
      </div>

      {tipos.length === 0 ? (
        <div className="palacio-card px-6 py-12 text-center">
          <p className="text-sm text-palacio-muted">
            No hay tipos de cliente cargados.
          </p>
        </div>
      ) : (
        <div className="palacio-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Listado</h2>
            <span className="text-xs text-palacio-muted">
              {tipos.length} tipo{tipos.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-palacio-border bg-zinc-50/80">
                  <Th>Nombre</Th>
                  <Th className="text-center">Lista de precios</Th>
                  <Th className="text-center">Clientes activos</Th>
                  <Th className="text-center">Estado</Th>
                  <Th>Creado por</Th>
                  <Th>Creado</Th>
                  <Th className="text-right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {tipos.map((t) => (
                  <tr
                    key={t.id_tipo_cliente}
                    className={[
                      "border-b border-palacio-border last:border-0",
                      t.activo ? "" : "opacity-60",
                    ].join(" ")}
                  >
                    <td className="px-5 py-4 align-middle font-medium text-zinc-900">
                      {t.nombre_tipo_cliente}
                    </td>
                    <td className="px-5 py-4 text-center align-middle">
                      <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700">
                        {t.lista_precio}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center align-middle text-palacio-muted">
                      {Number(t.cantidad_clientes) || 0}
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
                      {t.creado_por_nombre ??
                        (t.creado_por ? `${t.creado_por.slice(0, 8)}…` : "—")}
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {formatFecha(t.creado)}
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
        <TipoClienteFormModal
          key={enEdicion?.id_tipo_cliente ?? "nuevo"}
          onClose={() => setModalAbierto(false)}
          tipoCliente={enEdicion}
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
