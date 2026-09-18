"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  habilitarCliente,
  inhabilitarCliente,
} from "@/lib/clientes/actions";
import { ClienteFormModal } from "./ClienteFormModal";

/**
 * @param {{
 *   clientes: Array<{
 *     id_cliente: string,
 *     nombre_cliente: string,
 *     id_tipo_cliente: string,
 *     nombre_tipo_cliente: string,
 *     lista_precio: string,
 *     documento_cliente: string | null,
 *     telefono_cliente: string | null,
 *     mail_cliente: string | null,
 *     direccion_cliente: string | null,
 *     es_consumidor_final: boolean,
 *     activo: boolean,
 *     creado: string,
 *     editado: string,
 *     creado_por: string | null,
 *     creado_por_nombre?: string | null,
 *   }>,
 *   tiposActivos: Array<{
 *     id_tipo_cliente: string,
 *     nombre_tipo_cliente: string,
 *     lista_precio: string,
 *     activo: boolean,
 *   }>,
 *   incluirInactivos: boolean,
 * }} props
 */
export function ClientesTable({ clientes, tiposActivos, incluirInactivos }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [busqueda, setBusqueda] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [enEdicion, setEnEdicion] = useState(null);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter(
      (c) =>
        c.nombre_cliente.toLowerCase().includes(q) ||
        String(c.documento_cliente ?? "")
          .toLowerCase()
          .includes(q)
    );
  }, [clientes, busqueda]);

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

  function abrirEdicion(cliente) {
    if (cliente.es_consumidor_final) return;
    setEnEdicion(cliente);
    setModalAbierto(true);
  }

  function manejarErrorAccion(result) {
    window.alert(result.error);
    if (result.code === "CLI07" || result.code === "CLI08") {
      router.refresh();
    }
  }

  function toggleActivo(cliente) {
    if (cliente.es_consumidor_final) return;
    startTransition(async () => {
      const result = cliente.activo
        ? await inhabilitarCliente(cliente.id_cliente)
        : await habilitarCliente(cliente.id_cliente);
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
            placeholder="Buscar por nombre o documento"
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
          Nuevo cliente
        </button>
      </div>

      {filtrados.length === 0 ? (
        <div className="palacio-card px-6 py-12 text-center">
          <p className="text-sm text-palacio-muted">
            {clientes.length === 0
              ? "No hay clientes cargados."
              : "Ningún cliente coincide con la búsqueda."}
          </p>
        </div>
      ) : (
        <div className="palacio-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Listado</h2>
            <span className="text-xs text-palacio-muted">
              {filtrados.length} cliente
              {filtrados.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-palacio-border bg-zinc-50/80">
                  <Th>Nombre</Th>
                  <Th>Tipo de cliente</Th>
                  <Th>Documento</Th>
                  <Th>Teléfono</Th>
                  <Th>Mail</Th>
                  <Th className="text-center">Estado</Th>
                  <Th>Creado por</Th>
                  <Th className="text-right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => {
                  const esSistema = Boolean(c.es_consumidor_final);
                  return (
                    <tr
                      key={c.id_cliente}
                      className={[
                        "border-b border-palacio-border last:border-0",
                        c.activo ? "" : "opacity-60",
                      ].join(" ")}
                    >
                      <td className="px-5 py-4 align-middle font-medium text-zinc-900">
                        <span className="inline-flex flex-wrap items-center gap-2">
                          {c.nombre_cliente}
                          {esSistema ? (
                            <span className="inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-sky-700 uppercase">
                              Sistema
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td className="px-5 py-4 align-middle text-palacio-muted">
                        <span className="block text-zinc-800">
                          {c.nombre_tipo_cliente}
                        </span>
                        {c.lista_precio ? (
                          <span className="mt-0.5 inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                            {c.lista_precio}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <span className="font-mono text-xs text-zinc-700">
                          {esSistema || !c.documento_cliente
                            ? "—"
                            : c.documento_cliente}
                        </span>
                      </td>
                      <td className="px-5 py-4 align-middle text-palacio-muted">
                        {esSistema || !c.telefono_cliente
                          ? "—"
                          : c.telefono_cliente}
                      </td>
                      <td className="px-5 py-4 align-middle text-palacio-muted">
                        {c.mail_cliente || "—"}
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
                      <td className="px-5 py-4 align-middle text-palacio-muted">
                        {c.creado_por_nombre ??
                          (c.creado_por
                            ? `${c.creado_por.slice(0, 8)}…`
                            : "—")}
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            disabled={esSistema}
                            onClick={() => abrirEdicion(c)}
                            title={
                              esSistema
                                ? "El cliente de sistema no se puede editar"
                                : undefined
                            }
                            className="palacio-action-btn palacio-action-primary disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            disabled={pending || esSistema}
                            onClick={() => toggleActivo(c)}
                            title={
                              esSistema
                                ? "El cliente de sistema no se puede inhabilitar"
                                : undefined
                            }
                            className="palacio-action-btn disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {c.activo ? "Inhabilitar" : "Habilitar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalAbierto ? (
        <ClienteFormModal
          key={enEdicion?.id_cliente ?? "nuevo"}
          onClose={() => setModalAbierto(false)}
          cliente={enEdicion}
          tiposActivos={tiposActivos}
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
