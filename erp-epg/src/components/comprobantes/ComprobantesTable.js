"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { anularComprobante } from "@/lib/comprobantes/actions";
import { mapErrorComprobante } from "@/lib/comprobantes/errores";

const fechaFmt = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const monedaFmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

function formatFecha(valor) {
  if (!valor) return "—";
  const d = new Date(`${valor}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "—" : fechaFmt.format(d);
}

/**
 * @param {{ comprobantes: Array<Record<string, any>> }} props
 */
export function ComprobantesTable({ comprobantes }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busqueda, setBusqueda] = useState("");
  const [soloPendientes, setSoloPendientes] = useState(false);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return comprobantes.filter((c) => {
      if (soloPendientes && !(Number(c.saldo_pendiente) > 0 && !c.anulado))
        return false;
      if (!q) return true;
      return (
        String(c.nombre_proveedor ?? "")
          .toLowerCase()
          .includes(q) ||
        String(c.numero_formateado ?? "")
          .toLowerCase()
          .includes(q) ||
        String(c.nombre_tipo_comprobante ?? "")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [comprobantes, busqueda, soloPendientes]);

  function anular(c) {
    const ok = window.confirm(
      `¿Anular el comprobante ${c.nombre_tipo_comprobante} ${c.numero_formateado} de ${c.nombre_proveedor}? Esta acción es una baja lógica.`
    );
    if (!ok) return;

    startTransition(async () => {
      const result = await anularComprobante(c.id_comprobante);
      if (!result.ok) {
        const ui = mapErrorComprobante(result);
        window.alert(ui.message);
        if (ui.reload) router.refresh();
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
            placeholder="Buscar por proveedor, número o tipo"
            className="palacio-input max-w-xs"
          />
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={soloPendientes}
              onChange={(e) => setSoloPendientes(e.target.checked)}
              className="size-4 accent-palacio-red"
            />
            Solo con saldo pendiente
          </label>
        </div>
        <Link
          href="/compras/comprobantes/nuevo"
          className="palacio-btn-primary inline-flex px-4 py-2.5 text-sm"
        >
          Registrar comprobante
        </Link>
      </div>

      {filtrados.length === 0 ? (
        <div className="palacio-card px-6 py-12 text-center">
          <p className="text-sm text-palacio-muted">
            {comprobantes.length === 0
              ? "No hay comprobantes registrados."
              : "Ningún comprobante coincide con el filtro."}
          </p>
        </div>
      ) : (
        <div className="palacio-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Listado</h2>
            <span className="text-xs text-palacio-muted">
              {filtrados.length} comprobante{filtrados.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-palacio-border bg-zinc-50/80">
                  <Th>Proveedor</Th>
                  <Th>Tipo</Th>
                  <Th>Número</Th>
                  <Th>Fecha</Th>
                  <Th>Vencimiento</Th>
                  <Th className="text-right">Total</Th>
                  <Th className="text-right">Saldo</Th>
                  <Th className="text-center">Estado</Th>
                  <Th>Registrado por</Th>
                  <Th className="text-right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => (
                  <tr
                    key={c.id_comprobante}
                    className={[
                      "border-b border-palacio-border last:border-0",
                      c.anulado ? "opacity-60" : "",
                    ].join(" ")}
                  >
                    <td className="px-5 py-4 align-middle font-medium text-zinc-900">
                      {c.nombre_proveedor}
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {c.nombre_tipo_comprobante}
                      {c.letra ? ` (${c.letra})` : ""}
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <span className="font-mono text-xs text-zinc-700">
                        {c.numero_formateado}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {formatFecha(c.fecha_comprobante)}
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {formatFecha(c.fecha_vencimiento)}
                    </td>
                    <td className="px-5 py-4 text-right align-middle">
                      {monedaFmt.format(Number(c.importe_total) || 0)}
                    </td>
                    <td className="px-5 py-4 text-right align-middle font-medium text-zinc-900">
                      {monedaFmt.format(Number(c.saldo_pendiente) || 0)}
                    </td>
                    <td className="px-5 py-4 text-center align-middle">
                      <span
                        className={
                          c.anulado
                            ? "palacio-badge-inactivo"
                            : "palacio-badge-activo"
                        }
                      >
                        {c.anulado ? "Anulado" : "Vigente"}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {c.creado_por_nombre ?? "—"}
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/compras/comprobantes/${c.id_comprobante}`}
                          className="palacio-action-btn"
                        >
                          Ver detalle
                        </Link>
                        <button
                          type="button"
                          disabled={pending || c.anulado}
                          onClick={() => anular(c)}
                          className="palacio-action-btn palacio-action-danger"
                        >
                          Anular
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
