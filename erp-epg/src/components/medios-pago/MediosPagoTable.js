"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  habilitarMedioPago,
  inhabilitarMedioPago,
} from "@/lib/medios-pago/actions";
import { MedioPagoFormModal } from "./MedioPagoFormModal";

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
 *   mediosPago: Array<{
 *     id_medio_pago: string,
 *     nombre_medio_pago: string,
 *     requiere_referencia: boolean,
 *     activo: boolean,
 *     creado: string,
 *     editado: string,
 *     creado_por: string | null,
 *     creado_por_nombre?: string | null,
 *   }>,
 *   incluirInactivos: boolean,
 * }} props
 */
export function MediosPagoTable({ mediosPago, incluirInactivos }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [busqueda, setBusqueda] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [enEdicion, setEnEdicion] = useState(null);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return mediosPago;
    return mediosPago.filter((m) =>
      m.nombre_medio_pago.toLowerCase().includes(q)
    );
  }, [mediosPago, busqueda]);

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

  function abrirEdicion(medio) {
    setEnEdicion(medio);
    setModalAbierto(true);
  }

  function manejarErrorAccion(result) {
    window.alert(result.error);
    if (result.code === "MDP03") router.refresh();
  }

  function toggleActivo(medio) {
    startTransition(async () => {
      const result = medio.activo
        ? await inhabilitarMedioPago(medio.id_medio_pago)
        : await habilitarMedioPago(medio.id_medio_pago);
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
          Nuevo medio de pago
        </button>
      </div>

      {filtrados.length === 0 ? (
        <div className="palacio-card px-6 py-12 text-center">
          <p className="text-sm text-palacio-muted">
            {mediosPago.length === 0
              ? "No hay medios de pago cargados."
              : "Ningún medio de pago coincide con la búsqueda."}
          </p>
        </div>
      ) : (
        <div className="palacio-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Listado</h2>
            <span className="text-xs text-palacio-muted">
              {filtrados.length} medio
              {filtrados.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-palacio-border bg-zinc-50/80">
                  <Th>Nombre</Th>
                  <Th className="text-center">Requiere referencia</Th>
                  <Th className="text-center">Estado</Th>
                  <Th>Creado</Th>
                  <Th>Editado</Th>
                  <Th>Creado por</Th>
                  <Th className="text-right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((m) => (
                  <tr
                    key={m.id_medio_pago}
                    className={[
                      "border-b border-palacio-border last:border-0",
                      m.activo ? "" : "opacity-60",
                    ].join(" ")}
                  >
                    <td className="px-5 py-4 align-middle font-medium text-zinc-900">
                      {m.nombre_medio_pago}
                    </td>
                    <td className="px-5 py-4 text-center align-middle text-palacio-muted">
                      {m.requiere_referencia ? "Sí" : "No"}
                    </td>
                    <td className="px-5 py-4 text-center align-middle">
                      <span
                        className={
                          m.activo
                            ? "palacio-badge-activo"
                            : "palacio-badge-inactivo"
                        }
                      >
                        {m.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {formatFecha(m.creado)}
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {formatFecha(m.editado)}
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {m.creado_por_nombre ??
                        (m.creado_por ? `${m.creado_por.slice(0, 8)}…` : "—")}
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => abrirEdicion(m)}
                          className="palacio-action-btn palacio-action-primary"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => toggleActivo(m)}
                          className="palacio-action-btn"
                        >
                          {m.activo ? "Inhabilitar" : "Habilitar"}
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
        <MedioPagoFormModal
          key={enEdicion?.id_medio_pago ?? "nuevo"}
          onClose={() => setModalAbierto(false)}
          medioPago={enEdicion}
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
