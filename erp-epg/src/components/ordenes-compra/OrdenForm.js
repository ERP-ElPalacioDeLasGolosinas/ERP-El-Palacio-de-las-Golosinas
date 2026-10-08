"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Campo, Th, monedaFmt } from "@/components/comprobantes/alta/ui";
import { registrarOrden } from "@/lib/ordenes-compra/actions";
import { mapErrorOrden } from "@/lib/ordenes-compra/errores";

function lineaNueva(key) {
  return { key, id_producto: "", cantidad: "", precio_estimado: "" };
}

/**
 * @param {{
 *   proveedores: Array<{ id_proveedor: string, nombre_proveedor: string }>,
 *   productos: Array<{ id_producto: string, nombre_completo: string }>,
 * }} props
 */
export function OrdenForm({ proveedores, productos }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [cab, setCab] = useState({
    id_proveedor: "",
    fecha_emision: "",
    observaciones: "",
  });
  const [seq, setSeq] = useState(1);
  const [lineas, setLineas] = useState([lineaNueva(1)]);
  const [errores, setErrores] = useState({});
  const [errorServer, setErrorServer] = useState(null);

  function setCampo(campo, valor) {
    setCab((prev) => ({ ...prev, [campo]: valor }));
    setErrores((prev) => ({ ...prev, [campo]: null }));
    setErrorServer(null);
  }

  function setLinea(key, campo, valor) {
    setLineas((prev) =>
      prev.map((l) => (l.key === key ? { ...l, [campo]: valor } : l))
    );
    setErrores((prev) => ({ ...prev, detalle: null }));
    setErrorServer(null);
  }

  function validar() {
    const next = {};
    if (!cab.id_proveedor) next.id_proveedor = "Elegí un proveedor.";
    if (!cab.fecha_emision) next.fecha_emision = "La fecha de emisión es obligatoria.";

    const cargadas = lineas.filter(
      (l) => l.id_producto || l.cantidad || l.precio_estimado
    );
    if (cargadas.length === 0) {
      next.detalle = "Cargá al menos un artículo.";
    } else if (
      cargadas.some((l) => !l.id_producto || !(Number(l.cantidad) > 0))
    ) {
      next.detalle = "Cada renglón necesita un artículo y una cantidad mayor a cero.";
    } else if (cargadas.some((l) => l.precio_estimado !== "" && Number(l.precio_estimado) < 0)) {
      next.detalle = "El precio estimado no puede ser negativo.";
    } else {
      const ids = cargadas.map((l) => l.id_producto);
      if (new Set(ids).size !== ids.length) {
        next.detalle = "Un artículo no puede repetirse. Editá la cantidad del renglón.";
      }
    }

    setErrores(next);
    return Object.keys(next).length === 0;
  }

  function registrar() {
    setErrorServer(null);
    if (!validar()) return;

    const detalle = lineas
      .filter((l) => l.id_producto)
      .map((l) => ({
        id_producto: l.id_producto,
        cantidad: l.cantidad,
        precio_estimado: l.precio_estimado,
      }));

    startTransition(async () => {
      const result = await registrarOrden({
        id_proveedor: cab.id_proveedor,
        fecha_emision: cab.fecha_emision,
        observaciones: cab.observaciones,
        detalle,
      });

      if (!result.ok) {
        const ui = mapErrorOrden(result);
        if (ui.field) setErrores((prev) => ({ ...prev, [ui.field]: ui.message }));
        else setErrorServer(ui.message);
        return;
      }

      router.push(result.id ? `/compras/ordenes/${result.id}` : "/compras/ordenes");
      router.refresh();
    });
  }

  const totalEstimado = lineas.reduce((acc, l) => {
    const cantidad = Number(l.cantidad);
    const precio = Number(l.precio_estimado);
    if (!(cantidad > 0) || l.precio_estimado === "" || !(precio >= 0)) return acc;
    return acc + cantidad * precio;
  }, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="palacio-card p-5 md:p-6">
        <h2 className="mb-4 text-sm font-semibold text-zinc-900">Datos de la orden</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Campo label="Proveedor" error={errores.id_proveedor} requerido>
            <select
              value={cab.id_proveedor}
              onChange={(e) => setCampo("id_proveedor", e.target.value)}
              className="palacio-input"
            >
              <option value="">Seleccioná un proveedor…</option>
              {proveedores.map((p) => (
                <option key={p.id_proveedor} value={p.id_proveedor}>
                  {p.nombre_proveedor}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Fecha de emisión" error={errores.fecha_emision} requerido>
            <input
              type="date"
              value={cab.fecha_emision}
              onChange={(e) => setCampo("fecha_emision", e.target.value)}
              className="palacio-input"
            />
          </Campo>
          <Campo label="Observaciones (opcional)" full>
            <textarea
              value={cab.observaciones}
              onChange={(e) => setCampo("observaciones", e.target.value)}
              rows={2}
              maxLength={500}
              className="palacio-input"
            />
          </Campo>
        </div>
      </div>

      <div className="palacio-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">Artículos</h2>
          <span className="text-xs text-palacio-muted">
            {lineas.length} línea{lineas.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-palacio-border bg-zinc-50/80">
                <Th>Artículo</Th>
                <Th className="w-28 text-right">Cantidad</Th>
                <Th className="w-36 text-right">Precio estimado</Th>
                <Th className="w-32 text-right">Importe</Th>
                <Th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {lineas.map((l) => {
                const cantidad = Number(l.cantidad);
                const precio = Number(l.precio_estimado);
                const importe =
                  cantidad > 0 && l.precio_estimado !== "" && precio >= 0
                    ? cantidad * precio
                    : 0;
                return (
                  <tr key={l.key} className="border-b border-palacio-border last:border-0">
                    <td className="px-3 py-2 align-top">
                      <select
                        value={l.id_producto}
                        onChange={(e) => setLinea(l.key, "id_producto", e.target.value)}
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
                        onChange={(e) => setLinea(l.key, "cantidad", e.target.value)}
                        className="palacio-input text-right"
                      />
                    </td>
                    <td className="px-3 py-2 text-right align-top">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={l.precio_estimado}
                        onChange={(e) => setLinea(l.key, "precio_estimado", e.target.value)}
                        className="palacio-input text-right"
                        placeholder="Opcional"
                      />
                    </td>
                    <td className="px-3 py-2 text-right align-middle font-medium text-zinc-800">
                      {l.precio_estimado === "" ? "—" : monedaFmt.format(importe)}
                    </td>
                    <td className="px-3 py-2 text-right align-middle">
                      <button
                        type="button"
                        className="palacio-action-btn palacio-action-danger"
                        disabled={lineas.length === 1}
                        onClick={() =>
                          setLineas((prev) => prev.filter((x) => x.key !== l.key))
                        }
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3 border-t border-palacio-border px-5 py-3">
          <button
            type="button"
            className="palacio-btn-secondary px-3 py-2 text-sm"
            onClick={() => {
              const key = seq + 1;
              setSeq(key);
              setLineas((prev) => [...prev, lineaNueva(key)]);
            }}
          >
            Agregar línea
          </button>
          <dl className="min-w-52 text-right text-sm">
            <div className="flex justify-between gap-6 font-semibold text-zinc-900">
              <dt>Total estimado</dt>
              <dd className="tabular-nums">{monedaFmt.format(totalEstimado)}</dd>
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
            {pending ? "Registrando…" : "Registrar orden"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/compras/ordenes")}
            disabled={pending}
            className="palacio-btn-secondary px-4 py-2.5 text-sm"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
