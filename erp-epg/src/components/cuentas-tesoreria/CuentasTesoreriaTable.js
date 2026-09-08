"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  habilitarCuentaTesoreria,
  inhabilitarCuentaTesoreria,
} from "@/lib/cuentas-tesoreria/actions";
import { TIPOS_CUENTA } from "@/lib/cuentas-tesoreria/constantes";
import { CuentaTesoreriaFormModal } from "./CuentaTesoreriaFormModal";

const fechaFmt = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const montoFmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

function formatFecha(valor) {
  if (!valor) return "—";
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? "—" : fechaFmt.format(d);
}

function formatMonto(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? montoFmt.format(n) : "—";
}

/**
 * @param {{
 *   cuentas: Array<{
 *     id_cuenta: string,
 *     nombre_cuenta: string,
 *     tipo: string,
 *     descripcion: string | null,
 *     saldo_inicial: number | string,
 *     saldo_actual: number | string,
 *     activo: boolean,
 *     creado: string,
 *     editado: string,
 *     creado_por: string | null,
 *     creado_por_nombre?: string | null,
 *   }>,
 *   incluirInactivas: boolean,
 *   tipo: string | null,
 * }} props
 */
export function CuentasTesoreriaTable({ cuentas, incluirInactivas, tipo }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [busqueda, setBusqueda] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [enEdicion, setEnEdicion] = useState(null);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return cuentas;
    return cuentas.filter((c) =>
      c.nombre_cuenta.toLowerCase().includes(q)
    );
  }, [cuentas, busqueda]);

  function setParam(key, value) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function abrirAlta() {
    setEnEdicion(null);
    setModalAbierto(true);
  }

  function abrirEdicion(cuenta) {
    setEnEdicion(cuenta);
    setModalAbierto(true);
  }

  function manejarErrorAccion(result) {
    window.alert(result.error);
    if (result.code === "CTA03") router.refresh();
  }

  function toggleActivo(cuenta) {
    startTransition(async () => {
      const result = cuenta.activo
        ? await inhabilitarCuentaTesoreria(cuenta.id_cuenta)
        : await habilitarCuentaTesoreria(cuenta.id_cuenta);
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
          <select
            value={tipo ?? ""}
            onChange={(e) => setParam("tipo", e.target.value)}
            className="palacio-input max-w-[10rem]"
            aria-label="Filtrar por tipo"
          >
            <option value="">Todos los tipos</option>
            {TIPOS_CUENTA.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={incluirInactivas}
              onChange={(e) =>
                setParam("inactivas", e.target.checked ? "1" : "")
              }
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
          Nueva cuenta
        </button>
      </div>

      {filtradas.length === 0 ? (
        <div className="palacio-card px-6 py-12 text-center">
          <p className="text-sm text-palacio-muted">
            {cuentas.length === 0
              ? "No hay cuentas de tesorería cargadas."
              : "Ninguna cuenta coincide con la búsqueda."}
          </p>
        </div>
      ) : (
        <div className="palacio-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Listado</h2>
            <span className="text-xs text-palacio-muted">
              {filtradas.length} cuenta{filtradas.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-palacio-border bg-zinc-50/80">
                  <Th>Nombre</Th>
                  <Th>Tipo</Th>
                  <Th className="text-right">Saldo actual</Th>
                  <Th className="text-center">Estado</Th>
                  <Th>Creado</Th>
                  <Th>Creado por</Th>
                  <Th className="text-right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((c) => (
                  <tr
                    key={c.id_cuenta}
                    className={[
                      "border-b border-palacio-border last:border-0",
                      c.activo ? "" : "opacity-60",
                    ].join(" ")}
                  >
                    <td className="px-5 py-4 align-middle font-medium text-zinc-900">
                      {c.nombre_cuenta}
                      {c.descripcion ? (
                        <span className="mt-0.5 block text-xs font-normal text-palacio-muted">
                          {c.descripcion}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {c.tipo}
                    </td>
                    <td className="px-5 py-4 text-right align-middle tabular-nums text-zinc-900">
                      {formatMonto(c.saldo_actual)}
                    </td>
                    <td className="px-5 py-4 text-center align-middle">
                      <span
                        className={
                          c.activo
                            ? "palacio-badge-activo"
                            : "palacio-badge-inactivo"
                        }
                      >
                        {c.activo ? "Activa" : "Inactiva"}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {formatFecha(c.creado)}
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {c.creado_por_nombre ??
                        (c.creado_por ? `${c.creado_por.slice(0, 8)}…` : "—")}
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => abrirEdicion(c)}
                          className="palacio-action-btn palacio-action-primary"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => toggleActivo(c)}
                          className="palacio-action-btn"
                        >
                          {c.activo ? "Inhabilitar" : "Habilitar"}
                        </button>
                        <Link
                          href={`/tesoreria/cuentas/${c.id_cuenta}`}
                          className="palacio-action-btn"
                        >
                          Ver movimientos
                        </Link>
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
        <CuentaTesoreriaFormModal
          key={enEdicion?.id_cuenta ?? "nueva"}
          onClose={() => setModalAbierto(false)}
          cuenta={enEdicion}
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
