"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registrarRemito } from "@/lib/comprobantes/actions";
import { mapErrorComprobante } from "@/lib/comprobantes/errores";
import { Th } from "./ui";
import { FacturaAsociadaSelect } from "./FacturaAsociada";

const CAMPOS_CABECERA = ["id_proveedor", "id_tipo_comprobante", "numero", "fechas"];

let contadorLinea = 0;
function nuevaLinea() {
  contadorLinea += 1;
  return { key: `r${contadorLinea}`, id_producto: "", cantidad: "" };
}

/**
 * Campos de alta de un remito: comprobante asociado (opcional) y una
 * grilla de producto + cantidad, sin importes. Se envía a
 * `fn_remito_registrar` (la cabecera queda con importes en cero).
 *
 * @param {{
 *   cab: Record<string, string>,
 *   productos: Array<{ id_producto: string, nombre_completo: string }>,
 *   facturas: Array<Record<string, any>>,
 *   validarCabecera: () => boolean,
 *   setErrorCabecera: (campo: string, mensaje: string) => void,
 *   errorServer: string | null,
 *   setErrorServer: (mensaje: string | null) => void,
 * }} props
 */
export function RemitoCampos({
  cab,
  productos,
  facturas,
  validarCabecera,
  setErrorCabecera,
  errorServer,
  setErrorServer,
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [asociado, setAsociado] = useState("");
  const [lineas, setLineas] = useState([nuevaLinea()]);
  const [errorDetalle, setErrorDetalle] = useState(null);
  const [errorAsociado, setErrorAsociado] = useState(null);

  function setLinea(idx, cambios) {
    setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...cambios } : l)));
    setErrorDetalle(null);
    setErrorServer(null);
  }

  function agregarLinea() {
    setLineas((prev) => [...prev, nuevaLinea()]);
  }

  function quitarLinea(idx) {
    setLineas((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  function validar() {
    const validas = lineas.filter(
      (l) => Boolean(l.id_producto) && Number(l.cantidad) > 0
    );
    if (validas.length !== lineas.length || lineas.length === 0) {
      setErrorDetalle(
        "Cada línea necesita un producto y una cantidad mayor a cero."
      );
      return false;
    }
    setErrorDetalle(null);
    return true;
  }

  function aplicarError(ui) {
    if (ui.field && CAMPOS_CABECERA.includes(ui.field)) {
      setErrorCabecera(ui.field, ui.message);
    } else if (ui.field === "id_comprobante_asociado") {
      setErrorAsociado(ui.message);
    } else if (ui.field === "detalle" || ui.field === "importe") {
      setErrorDetalle(ui.message);
    } else {
      setErrorServer(ui.message);
    }
    if (ui.reload) router.refresh();
  }

  function registrar() {
    setErrorServer(null);
    const okCab = validarCabecera();
    const okDet = validar();
    if (!okCab || !okDet) return;

    startTransition(async () => {
      const result = await registrarRemito({
        id_proveedor: cab.id_proveedor,
        id_tipo_comprobante: cab.id_tipo_comprobante,
        punto_venta: cab.punto_venta,
        numero: cab.numero,
        fecha_comprobante: cab.fecha_comprobante,
        id_comprobante_asociado: asociado || null,
        observaciones: cab.observaciones || null,
        detalle: lineas.map((l) => ({
          id_producto: l.id_producto,
          cantidad: l.cantidad,
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
          Datos del remito
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <FacturaAsociadaSelect
            label="Factura asociada (opcional)"
            error={errorAsociado}
            idProveedor={cab.id_proveedor}
            facturas={facturas}
            value={asociado}
            onChange={(v) => {
              setAsociado(v);
              setErrorAsociado(null);
            }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
        <h3 className="text-sm font-semibold text-zinc-900">Productos</h3>
        <span className="text-xs text-palacio-muted">
          {lineas.length} línea{lineas.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-palacio-border bg-zinc-50/80">
              <Th>Producto</Th>
              <Th className="w-32 text-right">Cantidad</Th>
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
                  <select
                    value={l.id_producto}
                    onChange={(e) => setLinea(idx, { id_producto: e.target.value })}
                    className="palacio-input"
                  >
                    <option value="">Seleccioná un artículo…</option>
                    {productos.map((p) => (
                      <option key={p.id_producto} value={p.id_producto}>
                        {p.nombre_completo}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-right align-top">
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={l.cantidad}
                    onChange={(e) => setLinea(idx, { cantidad: e.target.value })}
                    className="palacio-input text-right"
                  />
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
      </div>

      {errorDetalle ? (
        <p className="mx-5 mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorDetalle}
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
          {pending ? "Registrando…" : "Registrar remito"}
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
