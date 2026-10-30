"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cambiarEstadoPedidoWeb } from "@/lib/pedidos-web/actions";
import { mensajeErrorPedidoWeb } from "@/lib/pedidos-web/errores";
import { badgeEstadoPedidoWeb } from "@/lib/pedidos-web/estado";
import { DesplazamientoHorizontal } from "@/components/ui/DesplazamientoHorizontal";

const fechaFmt = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const monedaFmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

function formatFecha(valor) {
  if (!valor) return "—";
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? "—" : fechaFmt.format(d);
}

/**
 * AO-04 · Detalle de un pedido web con las transiciones de estado válidas:
 * Pendiente de pago → Pagado | Cancelado · Pagado → En preparación · En preparación → Despachado
 * (envío) o Listo para retirar → Retirado (retiro por sucursal).
 *
 * @param {{ pedido: Record<string, any> }} props
 */
export function PedidoWebDetalle({ pedido }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(null);
  const [referencia, setReferencia] = useState("");
  const [tildadas, setTildadas] = useState(() => new Set());

  const lineas = pedido.lineas ?? [];
  const historial = pedido.historial ?? [];
  const n = pedido.numero;
  const esRetiro = pedido.tipo_entrega === "Retiro por sucursal";
  const esEnvio = pedido.tipo_entrega === "Envío a domicilio";

  function alternarLinea(nro) {
    setTildadas((prev) => {
      const next = new Set(prev);
      if (next.has(nro)) next.delete(nro);
      else next.add(nro);
      return next;
    });
  }

  const preparadas = lineas.filter((l) => tildadas.has(l.nro_linea)).length;
  const completo = lineas.length > 0 && preparadas === lineas.length;

  function cambiar(estado, confirmacion, ref = null) {
    if (!window.confirm(confirmacion)) return;
    setError(null);
    startTransition(async () => {
      const result = await cambiarEstadoPedidoWeb(pedido.id_pedido, estado, ref);
      if (!result.ok) setError(mensajeErrorPedidoWeb(result));
      else setReferencia("");
      router.refresh();
    });
  }

  return (
    <div className="hoja-preparacion">
      <div className="palacio-card p-5 md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-zinc-900">Pedido N.º {n}</h2>
            <span className={badgeEstadoPedidoWeb(pedido.estado)}>{pedido.estado}</span>
          </div>
          <div className="flex flex-wrap items-end gap-2 print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className="palacio-btn-secondary px-4 py-2 text-sm"
            >
              Imprimir
            </button>
            {pedido.estado === "Pendiente de pago" ? (
              <>
                <label className="flex flex-col gap-1 text-xs font-medium text-palacio-muted">
                  Referencia de la transferencia
                  <input
                    type="text"
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                    maxLength={100}
                    placeholder="N.º de operación"
                    className="palacio-input"
                  />
                </label>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    cambiar(
                      "Pagado",
                      `¿Confirmar la transferencia recibida del pedido N.º ${n}? Se descuenta el stock y se registra el cobro.`,
                      referencia
                    )
                  }
                  className="palacio-btn-primary px-4 py-2 text-sm"
                >
                  {pending ? "Procesando…" : "Confirmar pago"}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => cambiar("Cancelado", `¿Cancelar el pedido N.º ${n}?`)}
                  className="palacio-btn-secondary px-4 py-2 text-sm"
                >
                  Cancelar pedido
                </button>
              </>
            ) : null}
            {pedido.estado === "Pagado" ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => cambiar("En preparación", `¿Pasar el pedido N.º ${n} a preparación?`)}
                className="palacio-btn-primary px-4 py-2 text-sm"
              >
                {pending ? "Procesando…" : "Preparar"}
              </button>
            ) : null}
            {pedido.estado === "En preparación" && !esRetiro ? (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  cambiar("Despachado", `¿Marcar como despachado el pedido N.º ${n}? Se avisa al cliente por mail.`)
                }
                className="palacio-btn-primary px-4 py-2 text-sm"
              >
                {pending ? "Procesando…" : "Despachar"}
              </button>
            ) : null}
            {pedido.estado === "En preparación" && esRetiro ? (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  cambiar("Listo para retirar", `¿Dejar el pedido N.º ${n} listo para retirar en ${pedido.nombre_deposito_retiro}?`)
                }
                className="palacio-btn-primary px-4 py-2 text-sm"
              >
                {pending ? "Procesando…" : "Listo para retirar"}
              </button>
            ) : null}
            {pedido.estado === "Listo para retirar" ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => cambiar("Retirado", `¿Confirmar que el cliente retiró el pedido N.º ${n}?`)}
                className="palacio-btn-primary px-4 py-2 text-sm"
              >
                {pending ? "Procesando…" : "Marcar como retirado"}
              </button>
            ) : null}
          </div>
        </div>

        {error ? (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="rounded-xl border-2 border-palacio-border bg-zinc-50 p-4">
          <p className="text-xs font-semibold tracking-wide text-palacio-muted uppercase">Entrega</p>
          <p className="mt-1 text-xl font-bold text-zinc-900">
            {esRetiro
              ? `Retiro en ${pedido.nombre_deposito_retiro || "sucursal"}`
              : esEnvio
                ? "Envío a domicilio"
                : pedido.tipo_entrega || "—"}
          </p>
          <dl className="mt-3 grid gap-3 text-sm md:grid-cols-3">
            {esEnvio ? (
              <>
                <Dato label="Destinatario" valor={pedido.envio_destinatario} />
                <Dato label="Dirección de envío" valor={pedido.envio_direccion} />
                <Dato label="Localidad" valor={pedido.envio_localidad} />
                {pedido.envio_observaciones ? (
                  <Dato label="Indicaciones de envío" valor={pedido.envio_observaciones} full />
                ) : null}
              </>
            ) : (
              <>
                <Dato label="Cliente" valor={pedido.nombre_cliente} />
                <Dato label="Teléfono" valor={pedido.telefono_cliente} />
              </>
            )}
            {pedido.observaciones ? <Dato label="Observaciones" valor={pedido.observaciones} full /> : null}
          </dl>
        </div>
      </div>

      <div className="palacio-card mt-6">
        <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">Artículos a preparar</h2>
          <span className={`text-sm font-semibold ${completo ? "text-emerald-700" : "text-palacio-muted"}`}>
            {preparadas} de {lineas.length} preparados
          </span>
        </div>
        <ul>
          {lineas.map((l) => {
            const hecho = tildadas.has(l.nro_linea);
            return (
              <li key={l.nro_linea} className="border-b border-palacio-border last:border-0">
                <label
                  className={`flex cursor-pointer items-center gap-4 px-5 py-4 ${hecho ? "bg-emerald-50/60" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={hecho}
                    onChange={() => alternarLinea(l.nro_linea)}
                    className="h-6 w-6 shrink-0 accent-emerald-600"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm text-palacio-muted">{l.codigo_producto}</p>
                    <p className={`text-lg font-semibold text-zinc-900 ${hecho ? "line-through opacity-60" : ""}`}>
                      {[l.nombre_marca, l.nombre_producto].filter(Boolean).join(" · ")}
                    </p>
                    {l.presentacion ? <p className="text-base text-zinc-700">{l.presentacion}</p> : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-medium tracking-wide text-palacio-muted uppercase">Cantidad</p>
                    <p className="text-3xl font-bold text-zinc-900">{Number(l.cantidad)}</p>
                  </div>
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      <details className="palacio-card mt-6 p-5 md:p-6 print:hidden">
        <summary className="cursor-pointer text-sm font-semibold text-zinc-900">
          Precios, cobro y datos del cliente
        </summary>
        <dl className="mt-4 grid gap-4 text-sm md:grid-cols-3">
          <Dato label="Cliente" valor={pedido.nombre_cliente} />
          <Dato label="Documento" valor={pedido.documento_cliente} />
          <Dato label="Teléfono" valor={pedido.telefono_cliente} />
          <Dato label="Mail" valor={pedido.mail_cliente} />
          <Dato label="Dirección" valor={pedido.direccion_cliente} />
          <Dato label="Medio de pago" valor={pedido.medio_pago} />
          <Dato label="Fecha del pedido" valor={formatFecha(pedido.creado)} />
          <Dato label="Pago confirmado" valor={formatFecha(pedido.fecha_pago)} />
          <Dato label="Total" valor={monedaFmt.format(Number(pedido.importe_total) || 0)} />
        </dl>
        <DesplazamientoHorizontal className="mt-4">
          <table className="min-w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-palacio-border bg-zinc-50/80">
                <Th>Código</Th>
                <Th>Artículo</Th>
                <Th className="text-right">Cantidad</Th>
                <Th className="text-right">Precio</Th>
                <Th className="text-right">Importe</Th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((l) => (
                <tr key={l.nro_linea} className="border-b border-palacio-border last:border-0">
                  <td className="px-5 py-3 align-middle font-mono text-xs text-zinc-700">{l.codigo_producto}</td>
                  <td className="px-5 py-3 align-middle text-zinc-900">
                    {[l.nombre_marca, l.nombre_producto, l.presentacion].filter(Boolean).join(" · ")}
                  </td>
                  <td className="px-5 py-3 text-right align-middle">{Number(l.cantidad)}</td>
                  <td className="px-5 py-3 text-right align-middle text-palacio-muted">
                    {monedaFmt.format(Number(l.precio_unitario) || 0)}
                  </td>
                  <td className="px-5 py-3 text-right align-middle font-medium text-zinc-900">
                    {monedaFmt.format(Number(l.importe_linea) || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {Number(pedido.costo_envio) > 0 ? (
                <tr className="border-t border-palacio-border bg-zinc-50/60">
                  <td className="px-5 py-2 text-right font-medium text-palacio-muted" colSpan={4}>
                    Envío a domicilio
                  </td>
                  <td className="px-5 py-2 text-right text-zinc-900">
                    {monedaFmt.format(Number(pedido.costo_envio))}
                  </td>
                </tr>
              ) : null}
              <tr className="border-t border-palacio-border bg-zinc-50/60">
                <td className="px-5 py-2 text-right font-medium text-palacio-muted" colSpan={4}>
                  Total
                </td>
                <td className="px-5 py-2 text-right font-semibold text-zinc-900">
                  {monedaFmt.format(Number(pedido.importe_total) || 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </DesplazamientoHorizontal>
      </details>

      {historial.length > 0 ? (
        <div className="palacio-card mt-6 p-5 md:p-6 print:hidden">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">Historial</h2>
          <ul className="flex flex-col gap-1.5 text-sm text-zinc-900">
            {historial.map((h, i) => (
              <li key={`${h.estado}-${i}`}>
                <span className="font-medium">{h.estado}</span>
                <span className="text-palacio-muted">
                  {" "}
                  · {formatFecha(h.fecha)}
                  {h.usuario ? ` · por ${h.usuario}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2 print:hidden">
        <Link href="/ventas/pedidos-web" className="palacio-btn-secondary px-4 py-2.5 text-sm">
          Volver al listado
        </Link>
        {pedido.id_comprobante ? (
          <Link
            href={`/ventas/ordenes/${pedido.id_comprobante}`}
            className="palacio-btn-secondary px-4 py-2.5 text-sm"
          >
            Ver comprobante de venta
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function Dato({ label, valor, full = false }) {
  return (
    <div className={`flex flex-col gap-0.5 ${full ? "md:col-span-3" : ""}`}>
      <dt className="text-xs font-medium tracking-wide text-palacio-muted uppercase">{label}</dt>
      <dd className="text-zinc-900">{valor || "—"}</dd>
    </div>
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
