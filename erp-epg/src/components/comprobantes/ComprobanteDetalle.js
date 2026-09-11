"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { anularComprobante } from "@/lib/comprobantes/actions";
import { mapErrorComprobante } from "@/lib/comprobantes/errores";
import {
  badgeEstadoComprobante,
  labelEstadoComprobante,
} from "@/lib/comprobantes/estado";
import { badgeEstadoOrdenPago } from "@/lib/ordenes-pago/constantes";

/** Motivos de ND (`NotaDebitoCampos`) y NC (`NotaCreditoCampos`), para mostrar la etiqueta en el detalle. */
const MOTIVOS_LABEL = {
  interes_mora: "Interés por mora",
  flete: "Flete",
  diferencia_cambio: "Diferencia de cambio",
  gasto_bancario: "Gasto bancario",
  otro: "Otro",
  devolucion_mercaderia: "Devolución de mercadería",
  bonificacion: "Bonificación / ajuste",
  error_facturacion: "Error de facturación",
  anulacion: "Anulación",
};

const fechaFmt = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const monedaFmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});
const cantidadFmt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 });

function formatFecha(valor) {
  if (!valor) return "—";
  const d = new Date(`${valor}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "—" : fechaFmt.format(d);
}

/**
 * C-11 · Detalle de un comprobante de proveedor: cabecera con desglose
 * (subtotal / descuentos / impuestos / importe total) y líneas.
 *
 * @param {{
 *   comprobante: Record<string, any>,
 *   lineas: Array<Record<string, any>>,
 *   errorLineas?: string | null,
 *   ordenesPago?: Array<Record<string, any>>,
 * }} props
 */
export function ComprobanteDetalle({
  comprobante,
  lineas,
  errorLineas,
  ordenesPago = [],
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const subtotal = Number(comprobante.subtotal) || 0;
  const descuentoTotal = Number(comprobante.descuento_total) || 0;
  const impuestoTotal = Number(comprobante.impuesto_total) || 0;
  const importeTotal = Number(comprobante.importe_total) || 0;

  const clase = comprobante.clase ?? "factura";
  const mostrarCantidad = clase !== "nota_debito";
  const mostrarPrecio = clase === "factura" || clase === "nota_credito";
  const mostrarDescuento = clase === "factura";
  const mostrarImpuesto = clase !== "remito";
  const mostrarImporte = clase !== "remito";

  function anular() {
    const ok = window.confirm(
      `¿Anular el comprobante ${comprobante.nombre_tipo_comprobante} ${comprobante.numero_formateado} de ${comprobante.nombre_proveedor}? Esta acción es una baja lógica.`
    );
    if (!ok) return;

    startTransition(async () => {
      const result = await anularComprobante(comprobante.id_comprobante);
      if (!result.ok) {
        const ui = mapErrorComprobante(result);
        window.alert(ui.message);
        router.refresh();
        return;
      }
      router.push("/compras/comprobantes");
      router.refresh();
    });
  }

  return (
    <>
      {/* Cabecera */}
      <div className="palacio-card p-5 md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-900">
            Datos del comprobante
          </h2>
          <span className={badgeEstadoComprobante(comprobante.estado)}>
            {comprobante.anulado
              ? "Anulado"
              : labelEstadoComprobante(comprobante.estado, clase)}
          </span>
        </div>

        <dl className="grid gap-4 text-sm md:grid-cols-2">
          <Dato label="Proveedor" valor={comprobante.nombre_proveedor} />
          <Dato
            label="Tipo"
            valor={`${comprobante.nombre_tipo_comprobante}${
              comprobante.letra ? ` (${comprobante.letra})` : ""
            }`}
          />
          <Dato label="Número" valor={comprobante.numero_formateado} mono />
          <Dato
            label="Fecha del comprobante"
            valor={formatFecha(comprobante.fecha_comprobante)}
          />
          <Dato
            label="Vencimiento"
            valor={formatFecha(comprobante.fecha_vencimiento)}
          />
          {comprobante.motivo ? (
            <Dato
              label="Motivo"
              valor={MOTIVOS_LABEL[comprobante.motivo] ?? comprobante.motivo}
            />
          ) : null}
          {comprobante.id_comprobante_asociado ? (
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-medium tracking-wide text-palacio-muted uppercase">
                Comprobante asociado
              </dt>
              <dd className="text-zinc-900">
                <Link
                  href={`/compras/comprobantes/${comprobante.id_comprobante_asociado}`}
                  className="palacio-action-btn"
                >
                  {comprobante.nombre_tipo_comprobante_asociado}{" "}
                  {comprobante.numero_formateado_asociado}
                </Link>
              </dd>
            </div>
          ) : null}
          <Dato label="Subtotal" valor={monedaFmt.format(subtotal)} />
          <Dato
            label="Descuentos"
            valor={`−${monedaFmt.format(descuentoTotal)}`}
          />
          <Dato label="Impuestos" valor={monedaFmt.format(impuestoTotal)} />
          <Dato
            label="Importe total"
            valor={monedaFmt.format(importeTotal)}
          />
          <Dato
            label="Saldo pendiente"
            valor={monedaFmt.format(Number(comprobante.saldo_pendiente) || 0)}
          />
          <Dato
            label="Registrado por"
            valor={comprobante.creado_por_nombre ?? "—"}
          />
          {comprobante.observaciones ? (
            <Dato
              label="Observaciones"
              valor={comprobante.observaciones}
              full
            />
          ) : null}
        </dl>
      </div>

      {/* Detalle */}
      <div className="palacio-card mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">
            Detalle del comprobante
          </h2>
          <span className="text-xs text-palacio-muted">
            {lineas.length} línea{lineas.length === 1 ? "" : "s"}
          </span>
        </div>

        {errorLineas ? (
          <p className="mx-5 my-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {errorLineas}
          </p>
        ) : lineas.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-palacio-muted">
            El comprobante no tiene líneas de detalle.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-palacio-border bg-zinc-50/80">
                  <Th className="w-12 text-right">#</Th>
                  <Th>Artículo / concepto</Th>
                  {mostrarCantidad ? (
                    <Th className="w-24 text-right">Cantidad</Th>
                  ) : null}
                  {mostrarPrecio ? (
                    <Th className="w-28 text-right">Precio unit.</Th>
                  ) : null}
                  {mostrarDescuento ? (
                    <Th className="w-28 text-right">Descuento</Th>
                  ) : null}
                  {mostrarImpuesto ? (
                    <Th className="w-28 text-right">Impuesto</Th>
                  ) : null}
                  {mostrarImporte ? (
                    <Th className="w-32 text-right">Importe</Th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {lineas.map((l) => (
                  <tr
                    key={l.id_detalle}
                    className="border-b border-palacio-border last:border-0"
                  >
                    <td className="px-3 py-2 text-right align-middle text-palacio-muted">
                      {l.nro_linea}
                    </td>
                    <td className="px-3 py-2 align-middle text-zinc-900">
                      {l.nombre_producto ?? l.concepto ?? "—"}
                    </td>
                    {mostrarCantidad ? (
                      <td className="px-3 py-2 text-right align-middle">
                        {cantidadFmt.format(Number(l.cantidad) || 0)}
                      </td>
                    ) : null}
                    {mostrarPrecio ? (
                      <td className="px-3 py-2 text-right align-middle">
                        {monedaFmt.format(Number(l.precio_unitario) || 0)}
                      </td>
                    ) : null}
                    {mostrarDescuento ? (
                      <td className="px-3 py-2 text-right align-middle">
                        {monedaFmt.format(Number(l.descuento) || 0)}
                      </td>
                    ) : null}
                    {mostrarImpuesto ? (
                      <td className="px-3 py-2 text-right align-middle">
                        {monedaFmt.format(Number(l.impuesto) || 0)}
                      </td>
                    ) : null}
                    {mostrarImporte ? (
                      <td className="px-3 py-2 text-right align-middle font-medium text-zinc-800">
                        {monedaFmt.format(Number(l.importe_linea) || 0)}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-x-8 gap-y-1 border-t border-palacio-border px-5 py-3 text-right text-sm">
          <p className="text-palacio-muted">
            Subtotal{" "}
            <span className="font-semibold text-zinc-900">
              {monedaFmt.format(subtotal)}
            </span>
          </p>
          <p className="text-palacio-muted">
            Descuentos{" "}
            <span className="font-semibold text-zinc-900">
              −{monedaFmt.format(descuentoTotal)}
            </span>
          </p>
          <p className="text-palacio-muted">
            Impuestos{" "}
            <span className="font-semibold text-zinc-900">
              {monedaFmt.format(impuestoTotal)}
            </span>
          </p>
          <p className="text-palacio-muted">
            Importe total{" "}
            <span className="font-semibold text-zinc-900">
              {monedaFmt.format(importeTotal)}
            </span>
          </p>
        </div>
      </div>

      {ordenesPago.length > 0 ? (
        <div className="palacio-card mt-6 overflow-hidden">
          <div className="border-b border-palacio-border px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">
              Órdenes de pago
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-palacio-border bg-zinc-50/80">
                  <Th>Referencia</Th>
                  <Th className="text-center">Estado</Th>
                  <Th className="text-right">Importe imputado</Th>
                  <Th className="text-right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {ordenesPago.map((o) => (
                  <tr
                    key={o.id_orden_pago}
                    className="border-b border-palacio-border last:border-0"
                  >
                    <td className="px-3 py-2 align-middle text-palacio-muted">
                      {o.referencia || "—"}
                    </td>
                    <td className="px-3 py-2 text-center align-middle">
                      <span className={badgeEstadoOrdenPago(o.estado)}>
                        {o.estado}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right align-middle font-medium text-zinc-800">
                      {monedaFmt.format(Number(o.importe_imputado) || 0)}
                    </td>
                    <td className="px-3 py-2 text-right align-middle">
                      <Link
                        href={`/tesoreria/ordenes-de-pago/${o.id_orden_pago}`}
                        className="palacio-action-btn"
                      >
                        Ver orden
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => router.push("/compras/comprobantes")}
          className="palacio-btn-secondary px-4 py-2.5 text-sm"
        >
          Volver al listado
        </button>
        <button
          type="button"
          onClick={anular}
          disabled={pending || comprobante.anulado}
          className="palacio-btn-primary px-4 py-2.5 text-sm"
        >
          {pending ? "Anulando…" : "Anular comprobante"}
        </button>
      </div>
    </>
  );
}

function Dato({ label, valor, mono = false, full = false }) {
  return (
    <div className={`flex flex-col gap-0.5 ${full ? "md:col-span-2" : ""}`}>
      <dt className="text-xs font-medium tracking-wide text-palacio-muted uppercase">
        {label}
      </dt>
      <dd className={`text-zinc-900 ${mono ? "font-mono text-xs" : ""}`}>
        {valor || "—"}
      </dd>
    </div>
  );
}

function Th({ children, className = "" }) {
  return (
    <th
      className={`px-3 py-2 text-[11px] font-semibold tracking-wider text-palacio-muted uppercase ${className}`}
    >
      {children}
    </th>
  );
}
