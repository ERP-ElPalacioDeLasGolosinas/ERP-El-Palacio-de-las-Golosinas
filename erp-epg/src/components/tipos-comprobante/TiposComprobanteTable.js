"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  habilitarTipoComprobante,
  inhabilitarTipoComprobante,
} from "@/lib/tipos-comprobante/actions";
import { TipoComprobanteFormModal } from "./TipoComprobanteFormModal";

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

function labelSigno(signo) {
  if (Number(signo) === 1) return "+1";
  if (Number(signo) === -1) return "−1";
  return "—";
}

/**
 * @param {{
 *   tipos: Array<{
 *     id_tipo_comprobante: string,
 *     nombre_tipo_comprobante: string,
 *     letra: string | null,
 *     es_fiscal: boolean,
 *     signo: number,
 *     aplica_compra: boolean,
 *     aplica_venta: boolean,
 *     aplica_pago: boolean,
 *     activo: boolean,
 *     creado: string,
 *     editado: string,
 *     creado_por: string | null,
 *     creado_por_nombre?: string | null,
 *   }>,
 *   incluirInactivos: boolean,
 * }} props
 */
export function TiposComprobanteTable({ tipos, incluirInactivos }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [busqueda, setBusqueda] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [enEdicion, setEnEdicion] = useState(null);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return tipos;
    return tipos.filter((t) =>
      t.nombre_tipo_comprobante.toLowerCase().includes(q)
    );
  }, [tipos, busqueda]);

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
    if (result.code === "CPB03") router.refresh();
  }

  function toggleActivo(tipo) {
    startTransition(async () => {
      const result = tipo.activo
        ? await inhabilitarTipoComprobante(tipo.id_tipo_comprobante)
        : await habilitarTipoComprobante(tipo.id_tipo_comprobante);
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
          Nuevo tipo de comprobante
        </button>
      </div>

      {filtrados.length === 0 ? (
        <div className="palacio-card px-6 py-12 text-center">
          <p className="text-sm text-palacio-muted">
            {tipos.length === 0
              ? "No hay tipos de comprobante cargados."
              : "Ningún tipo de comprobante coincide con la búsqueda."}
          </p>
        </div>
      ) : (
        <div className="palacio-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Listado</h2>
            <span className="text-xs text-palacio-muted">
              {filtrados.length} tipo
              {filtrados.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-palacio-border bg-zinc-50/80">
                  <Th>Nombre</Th>
                  <Th className="text-center">Letra</Th>
                  <Th className="text-center">Fiscal</Th>
                  <Th className="text-center">Signo</Th>
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
                    key={t.id_tipo_comprobante}
                    className={[
                      "border-b border-palacio-border last:border-0",
                      t.activo ? "" : "opacity-60",
                    ].join(" ")}
                  >
                    <td className="px-5 py-4 align-middle font-medium text-zinc-900">
                      {t.nombre_tipo_comprobante}
                    </td>
                    <td className="px-5 py-4 text-center align-middle text-palacio-muted">
                      {t.letra || "—"}
                    </td>
                    <td className="px-5 py-4 text-center align-middle text-palacio-muted">
                      {t.es_fiscal ? "Sí" : "No"}
                    </td>
                    <td className="px-5 py-4 text-center align-middle font-medium text-zinc-800">
                      {labelSigno(t.signo)}
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
                      {t.creado_por_nombre ??
                        (t.creado_por ? `${t.creado_por.slice(0, 8)}…` : "—")}
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
        <TipoComprobanteFormModal
          key={enEdicion?.id_tipo_comprobante ?? "nuevo"}
          onClose={() => setModalAbierto(false)}
          tipoComprobante={enEdicion}
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
