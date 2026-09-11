"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registrarNotaDebito } from "@/lib/comprobantes/actions";
import { mapErrorComprobante } from "@/lib/comprobantes/errores";
import { Campo, Th, monedaFmt } from "./ui";
import { FacturaAsociadaSelect } from "./FacturaAsociada";

const CAMPOS_CABECERA = ["id_proveedor", "id_tipo_comprobante", "numero", "fechas"];

const MOTIVOS = [
  { value: "interes_mora", label: "Interés por mora" },
  { value: "flete", label: "Flete" },
  { value: "diferencia_cambio", label: "Diferencia de cambio" },
  { value: "gasto_bancario", label: "Gasto bancario" },
  { value: "otro", label: "Otro" },
];

let contadorLinea = 0;
function nuevaLinea() {
  contadorLinea += 1;
  return { key: `n${contadorLinea}`, concepto: "", importe: "", impuesto: "" };
}

function importeLinea(l) {
  return (Number(l.importe) || 0) + (Number(l.impuesto) || 0);
}

/**
 * Campos de alta de una nota de débito: comprobante asociado (opcional),
 * motivo y una grilla de conceptos con importe e impuesto. Se envía a
 * `fn_nota_debito_registrar`.
 *
 * @param {{
 *   cab: Record<string, string>,
 *   facturas: Array<Record<string, any>>,
 *   validarCabecera: () => boolean,
 *   setErrorCabecera: (campo: string, mensaje: string) => void,
 *   errorServer: string | null,
 *   setErrorServer: (mensaje: string | null) => void,
 * }} props
 */
export function NotaDebitoCampos({
  cab,
  facturas,
  validarCabecera,
  setErrorCabecera,
  errorServer,
  setErrorServer,
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [asociado, setAsociado] = useState("");
  const [motivo, setMotivo] = useState("");
  const [lineas, setLineas] = useState([nuevaLinea()]);
  const [errores, setErrores] = useState({});

  function limpiar(campo) {
    setErrores((prev) => ({ ...prev, [campo]: null }));
    setErrorServer(null);
  }

  function setLinea(idx, cambios) {
    setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...cambios } : l)));
    limpiar("detalle");
  }

  function agregarLinea() {
    setLineas((prev) => [...prev, nuevaLinea()]);
  }

  function quitarLinea(idx) {
    setLineas((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  const total = useMemo(
    () => Math.round(lineas.reduce((acc, l) => acc + importeLinea(l), 0) * 100) / 100,
    [lineas]
  );

  function validar() {
    const next = {};
    if (!MOTIVOS.some((m) => m.value === motivo))
      next.motivo = "Elegí un motivo para la nota de débito.";

    const lineasValidas = lineas.filter(
      (l) =>
        l.concepto.trim() &&
        (Number(l.importe) || 0) >= 0 &&
        (Number(l.impuesto) || 0) >= 0
    );
    if (lineasValidas.length !== lineas.length || lineas.length === 0)
      next.detalle =
        "Cada línea necesita un concepto e importes no negativos.";
    else if (!(total > 0))
      next.detalle = "El importe total de la nota de débito debe ser mayor a cero.";

    setErrores(next);
    return Object.keys(next).length === 0;
  }

  function aplicarError(ui) {
    if (ui.field && CAMPOS_CABECERA.includes(ui.field)) {
      setErrorCabecera(ui.field, ui.message);
    } else if (ui.field === "motivo" || ui.field === "id_comprobante_asociado") {
      setErrores((prev) => ({ ...prev, [ui.field]: ui.message }));
    } else if (ui.field === "detalle" || ui.field === "importe") {
      setErrores((prev) => ({ ...prev, detalle: ui.message }));
    } else {
      setErrorServer(ui.message);
    }
    if (ui.reload) router.refresh();
  }

  function registrar() {
    setErrorServer(null);
    const okCab = validarCabecera();
    const okLocal = validar();
    if (!okCab || !okLocal) return;

    startTransition(async () => {
      const result = await registrarNotaDebito({
        id_proveedor: cab.id_proveedor,
        id_tipo_comprobante: cab.id_tipo_comprobante,
        punto_venta: cab.punto_venta,
        numero: cab.numero,
        fecha_comprobante: cab.fecha_comprobante,
        id_comprobante_asociado: asociado || null,
        motivo,
        observaciones: cab.observaciones || null,
        detalle: lineas.map((l) => ({
          concepto: l.concepto,
          importe: l.importe || 0,
          impuesto: l.impuesto || 0,
        })),
      });

      if (!result.ok) {
        aplicarError(mapErrorComprobante(result));
        return;
      }

      router.push("/compras/comprobantes");
      router.refresh();
    });
  }

  return (
    <div className="palacio-card mt-6 overflow-hidden">
      <div className="border-b border-palacio-border px-5 py-4">
        <h2 className="mb-4 text-sm font-semibold text-zinc-900">
          Datos de la nota de débito
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <FacturaAsociadaSelect
            label="Factura asociada (opcional)"
            error={errores.id_comprobante_asociado}
            idProveedor={cab.id_proveedor}
            facturas={facturas}
            value={asociado}
            onChange={(v) => {
              setAsociado(v);
              limpiar("id_comprobante_asociado");
            }}
          />
          <Campo label="Motivo" error={errores.motivo} requerido>
            <select
              value={motivo}
              onChange={(e) => {
                setMotivo(e.target.value);
                limpiar("motivo");
              }}
              className="palacio-input"
            >
              <option value="">Seleccioná un motivo…</option>
              {MOTIVOS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </Campo>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
        <h3 className="text-sm font-semibold text-zinc-900">Conceptos</h3>
        <span className="text-xs text-palacio-muted">
          {lineas.length} línea{lineas.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-palacio-border bg-zinc-50/80">
              <Th>Concepto</Th>
              <Th className="w-32 text-right">Importe</Th>
              <Th className="w-32 text-right">Impuesto</Th>
              <Th className="w-32 text-right">Total</Th>
              <Th className="w-16" />
            </tr>
          </thead>
          <tbody>
            {lineas.map((l, idx) => (
              <tr
                key={l.key}
                className="border-b border-palacio-border last:border-0"
              >
                <td className="px-3 py-2 align-top">
                  <input
                    type="text"
                    value={l.concepto}
                    onChange={(e) => setLinea(idx, { concepto: e.target.value })}
                    className="palacio-input"
                    placeholder="Interés, flete, gasto bancario…"
                    maxLength={200}
                  />
                </td>
                <td className="px-3 py-2 text-right align-top">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={l.importe}
                    onChange={(e) => setLinea(idx, { importe: e.target.value })}
                    className="palacio-input text-right"
                    placeholder="0.00"
                  />
                </td>
                <td className="px-3 py-2 text-right align-top">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={l.impuesto}
                    onChange={(e) => setLinea(idx, { impuesto: e.target.value })}
                    className="palacio-input text-right"
                    placeholder="0.00"
                  />
                </td>
                <td className="px-3 py-2 text-right align-middle font-medium text-zinc-800">
                  {monedaFmt.format(importeLinea(l))}
                </td>
                <td className="px-3 py-2 text-right align-middle">
                  <button
                    type="button"
                    onClick={() => quitarLinea(idx)}
                    disabled={lineas.length === 1}
                    className="palacio-action-btn palacio-action-danger"
                  >
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3 border-t border-palacio-border px-5 py-3">
        <button
          type="button"
          onClick={agregarLinea}
          className="palacio-btn-secondary px-3 py-2 text-sm"
        >
          Agregar línea
        </button>
        <dl className="min-w-52 space-y-1 text-right text-sm">
          <div className="flex justify-between gap-6 border-t border-palacio-border pt-1 font-semibold text-zinc-900">
            <dt>Importe total</dt>
            <dd className="tabular-nums">{monedaFmt.format(total)}</dd>
          </div>
        </dl>
      </div>

      {errores.detalle ? (
        <p className="mx-5 mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errores.detalle}
        </p>
      ) : null}

      {errorServer ? (
        <p className="mx-5 mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorServer}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 border-t border-palacio-border px-5 py-4">
        <button
          type="button"
          onClick={registrar}
          disabled={pending}
          className="palacio-btn-primary px-4 py-2.5 text-sm"
        >
          {pending ? "Registrando…" : "Registrar nota de débito"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/compras/comprobantes")}
          disabled={pending}
          className="palacio-btn-secondary px-4 py-2.5 text-sm"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
