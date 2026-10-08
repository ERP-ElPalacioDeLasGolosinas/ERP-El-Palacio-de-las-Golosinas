"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { posicionCuenta } from "@/lib/cuentas-corrientes/posicion";

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
  const d = new Date(String(valor).length <= 10 ? `${valor}T00:00:00` : valor);
  return Number.isNaN(d.getTime()) ? "—" : fechaFmt.format(d);
}

function hrefDe(destino, id) {
  if (destino === "comprobante") return `/compras/comprobantes/${id}`;
  if (destino === "pago") return `/tesoreria/pagos/${id}`;
  if (destino === "venta") return `/ventas/ordenes/${id}`;
  if (destino === "cobro") return `/tesoreria/cobranzas/${id}`;
  return null;
}

/**
 * @param {{
 *   lado: "proveedor" | "cliente",
 *   saldo: number,
 *   movimientos: Array<Record<string, any>>,
 *   filtros: { desde: string, hasta: string },
 *   hayMovimientos: boolean,
 * }} props
 */
export function MovimientosCuenta({ lado, saldo, movimientos, filtros, hayMovimientos }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pos = posicionCuenta(lado, saldo);

  function setParam(key, value) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <>
      <div className="palacio-card mb-6 flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-palacio-muted">Saldo</p>
          <p className="mt-1 text-2xl font-bold text-zinc-900">
            {monedaFmt.format(Math.abs(Number(saldo) || 0))}
          </p>
          <p className="mt-1 text-sm text-palacio-muted">{pos.detalle}</p>
        </div>
        <span className={`${pos.badge} text-sm`}>{pos.label}</span>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-palacio-muted">
          Desde
          <input
            type="date"
            value={filtros.desde}
            onChange={(e) => setParam("desde", e.target.value)}
            className="palacio-input"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-palacio-muted">
          Hasta
          <input
            type="date"
            value={filtros.hasta}
            onChange={(e) => setParam("hasta", e.target.value)}
            className="palacio-input"
          />
        </label>
      </div>

      <div className="palacio-card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-palacio-border bg-zinc-50 text-xs uppercase tracking-wide text-palacio-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Comprobante</th>
              <th className="px-4 py-3 font-medium">Detalle</th>
              <th className="px-4 py-3 font-medium">Efecto</th>
              <th className="px-4 py-3 text-right font-medium">Importe</th>
              {lado === "proveedor" ? (
                <th className="px-4 py-3 text-right font-medium">Restante</th>
              ) : null}
              <th className="px-4 py-3 text-right font-medium">Saldo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-palacio-border">
            {movimientos.length === 0 ? (
              <tr>
                <td colSpan={lado === "proveedor" ? 7 : 6} className="px-4 py-8 text-center text-palacio-muted">
                  {hayMovimientos
                    ? "No hay movimientos en ese rango de fechas."
                    : "Sin movimientos. El saldo es cero."}
                </td>
              </tr>
            ) : (
              movimientos.map((m) => {
                const href = hrefDe(m.destino, m.id_documento);
                const titulo = m.numero ? `${m.tipo} ${m.numero}` : m.tipo;
                const saldoFila = posicionCuenta(lado, m.saldo);
                return (
                  <tr key={m.id_documento}>
                    <td className="px-4 py-3 text-zinc-700">{formatFecha(m.fecha)}</td>
                    <td className="px-4 py-3 text-zinc-900">
                      {href ? (
                        <Link href={href} className="hover:text-palacio-red hover:underline">
                          {titulo}
                        </Link>
                      ) : (
                        titulo
                      )}
                    </td>
                    <td className="px-4 py-3 text-palacio-muted">{m.descripcion}</td>
                    <td className="px-4 py-3">
                      <span className={m.efecto === "En contra" ? "palacio-badge-en-contra" : m.efecto === "A favor" ? "palacio-badge-activo" : "palacio-badge-inactivo"}>
                        {m.efecto}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-zinc-900">
                      {monedaFmt.format(Number(m.importe) || 0)}
                    </td>
                    {lado === "proveedor" ? (
                      <td className="px-4 py-3 text-right text-zinc-900">
                        {m.restante == null ? "—" : monedaFmt.format(Number(m.restante) || 0)}
                      </td>
                    ) : null}
                    <td className="px-4 py-3 text-right">
                      <span className="font-medium text-zinc-900">
                        {monedaFmt.format(Math.abs(Number(m.saldo) || 0))}
                      </span>
                      <span className="ml-2 text-xs text-palacio-muted">{saldoFila.label}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
