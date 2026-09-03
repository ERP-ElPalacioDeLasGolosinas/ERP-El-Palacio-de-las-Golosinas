"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  eliminarProveedor,
  habilitarProveedor,
  inhabilitarProveedor,
} from "@/lib/proveedores/actions";
import { ProveedorFormModal } from "./ProveedorFormModal";

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
 *   proveedores: Array<{
 *     id_proveedor: string,
 *     nombre_proveedor: string,
 *     rs_proveedor: string,
 *     cuit_proveedor: string,
 *     telefono_proveedor: number | string,
 *     mail_proveedor: string,
 *     activo: boolean,
 *     creado: string,
 *     editado: string,
 *     registrado_por: string | null,
 *     registrado_por_nombre?: string | null,
 *   }>,
 *   incluirInactivos: boolean,
 * }} props
 */
export function ProveedoresTable({ proveedores, incluirInactivos }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [busqueda, setBusqueda] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [enEdicion, setEnEdicion] = useState(null);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return proveedores;
    return proveedores.filter(
      (p) =>
        p.nombre_proveedor.toLowerCase().includes(q) ||
        String(p.cuit_proveedor ?? "")
          .toLowerCase()
          .includes(q) ||
        String(p.mail_proveedor ?? "")
          .toLowerCase()
          .includes(q)
    );
  }, [proveedores, busqueda]);

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

  function abrirEdicion(proveedor) {
    setEnEdicion(proveedor);
    setModalAbierto(true);
  }

  function manejarErrorAccion(result) {
    window.alert(result.error);
    if (result.code === "PRV05") router.refresh();
  }

  function toggleActivo(proveedor) {
    startTransition(async () => {
      const result = proveedor.activo
        ? await inhabilitarProveedor(proveedor.id_proveedor)
        : await habilitarProveedor(proveedor.id_proveedor);
      if (!result.ok) {
        manejarErrorAccion(result);
        return;
      }
      router.refresh();
    });
  }

  function eliminar(proveedor) {
    const confirmado = window.confirm(
      `¿Eliminar el proveedor "${proveedor.nombre_proveedor}"? Esta acción no se puede deshacer.`
    );
    if (!confirmado) return;

    startTransition(async () => {
      const result = await eliminarProveedor(proveedor.id_proveedor);
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
            placeholder="Buscar por nombre, CUIT o mail"
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
          Nuevo proveedor
        </button>
      </div>

      {filtrados.length === 0 ? (
        <div className="palacio-card px-6 py-12 text-center">
          <p className="text-sm text-palacio-muted">
            {proveedores.length === 0
              ? "No hay proveedores cargados."
              : "Ningún proveedor coincide con la búsqueda."}
          </p>
        </div>
      ) : (
        <div className="palacio-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Listado</h2>
            <span className="text-xs text-palacio-muted">
              {filtrados.length} proveedor
              {filtrados.length === 1 ? "" : "es"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-palacio-border bg-zinc-50/80">
                  <Th>Nombre</Th>
                  <Th>Razón social</Th>
                  <Th>CUIT</Th>
                  <Th>Contacto</Th>
                  <Th className="text-center">Estado</Th>
                  <Th>Registrado</Th>
                  <Th>Registrado por</Th>
                  <Th className="text-right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => (
                  <tr
                    key={p.id_proveedor}
                    className={[
                      "border-b border-palacio-border last:border-0",
                      p.activo ? "" : "opacity-60",
                    ].join(" ")}
                  >
                    <td className="px-5 py-4 align-middle font-medium text-zinc-900">
                      {p.nombre_proveedor}
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {p.rs_proveedor}
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <span className="font-mono text-xs text-zinc-700">
                        {p.cuit_proveedor}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      <p>{p.telefono_proveedor}</p>
                      <p className="text-xs">{p.mail_proveedor}</p>
                    </td>
                    <td className="px-5 py-4 text-center align-middle">
                      <span
                        className={
                          p.activo
                            ? "palacio-badge-activo"
                            : "palacio-badge-inactivo"
                        }
                      >
                        {p.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {formatFecha(p.creado)}
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {p.registrado_por_nombre ??
                        (p.registrado_por
                          ? `${p.registrado_por.slice(0, 8)}…`
                          : "—")}
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => abrirEdicion(p)}
                          className="palacio-action-btn palacio-action-primary"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => toggleActivo(p)}
                          className="palacio-action-btn"
                        >
                          {p.activo ? "Inhabilitar" : "Habilitar"}
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => eliminar(p)}
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
        <ProveedorFormModal
          key={enEdicion?.id_proveedor ?? "nuevo"}
          onClose={() => setModalAbierto(false)}
          proveedor={enEdicion}
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
