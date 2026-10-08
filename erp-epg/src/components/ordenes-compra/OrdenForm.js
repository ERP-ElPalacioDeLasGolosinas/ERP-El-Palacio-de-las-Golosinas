"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Campo } from "@/components/comprobantes/alta/ui";
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
          <button
            type="button"
            className="palacio-btn-secondary"
            onClick={() => {
              const key = seq + 1;
              setSeq(key);
              setLineas((prev) => [...prev, lineaNueva(key)]);
            }}
          >
            Agregar artículo
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-palacio-border">
                <th className="px-3 py-2 text-[11px] font-semibold tracking-wider text-palacio-muted uppercase">
                  Artículo
                </th>
                <th className="px-3 py-2 text-[11px] font-semibold tracking-wider text-palacio-muted uppercase">
                  Cantidad
                </th>
                <th className="px-3 py-2 text-[11px] font-semibold tracking-wider text-palacio-muted uppercase">
                  Precio estimado
                </th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {lineas.map((l) => (
                <tr key={l.key} className="border-b border-palacio-border last:border-0">
                  <td className="px-3 py-2">
                    <select
                      value={l.id_producto}
                      onChange={(e) => setLinea(l.key, "id_producto", e.target.value)}
                      className="palacio-input"
                    >
                      <option value="">Seleccioná…</option>
                      {productos.map((p) => (
                        <option key={p.id_producto} value={p.id_producto}>
                          {p.nombre_completo}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={l.cantidad}
                      onChange={(e) => setLinea(l.key, "cantidad", e.target.value)}
                      className="palacio-input w-28"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={l.precio_estimado}
                      onChange={(e) => setLinea(l.key, "precio_estimado", e.target.value)}
                      className="palacio-input w-32"
                      placeholder="Opcional"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className="text-sm text-palacio-red underline disabled:opacity-40"
                      disabled={lineas.length === 1}
                      onClick={() =>
                        setLineas((prev) => prev.filter((x) => x.key !== l.key))
                      }
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {errores.detalle ? (
          <p className="px-5 py-3 text-sm text-red-600">{errores.detalle}</p>
        ) : null}
      </div>

      {errorServer ? (
        <div className="palacio-card border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {errorServer}
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="button"
          className="palacio-btn-primary"
          disabled={pending}
          onClick={registrar}
        >
          {pending ? "Registrando…" : "Registrar orden"}
        </button>
      </div>
    </div>
  );
}
