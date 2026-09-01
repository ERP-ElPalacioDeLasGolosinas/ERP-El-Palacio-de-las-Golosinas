"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  listarComprasDisponibles,
  registrarIngresoPorCompra,
} from "@/lib/movimientos/actions";
import { mapErrorLote } from "@/lib/stock/errores";
import { CarritoLoteIngreso } from "@/components/movimientos/CarritoLoteIngreso";
import { ProductoBuscadorLote } from "@/components/movimientos/ProductoBuscadorLote";

const monedaFmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

/**
 * Alta de un lote contra una compra YA EXISTENTE: se elige depósito + compra
 * asociada una vez, y N productos se cargan a una tabla editable antes de
 * registrar todo junto vía `fn_lote_registrar_desde_compra`.
 *
 * El carrito reutiliza `CarritoLoteIngreso` (mismo componente que "ingreso por
 * compra" dentro de Movimientos): se busca un producto por código o nombre,
 * se agrega como fila y se editan cantidad / fechas / observaciones ahí mismo.
 *
 * @param {{
 *   depositos: Array<{ id_deposito: string, nombre_deposito: string }>,
 * }} props
 */
export function LoteForm({ depositos }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [idDeposito, setIdDeposito] = useState("");
  const [compras, setCompras] = useState([]);
  const [idCompra, setIdCompra] = useState("");
  const [detalleLote, setDetalleLote] = useState("");

  const [carrito, setCarrito] = useState([]);
  const [errores, setErrores] = useState({});
  const [errorServer, setErrorServer] = useState(null);

  useEffect(() => {
    listarComprasDisponibles().then(({ data }) => setCompras(data ?? []));
  }, []);

  const sinCompras = compras.length === 0;

  function agregarProducto(producto) {
    setErrorServer(null);
    setCarrito((prev) => [
      ...prev,
      {
        id_producto: producto.id_producto,
        codigo_producto: producto.codigo_producto ?? "",
        nombre_completo: producto.nombre_completo ?? "",
        cantidad: "",
        fecha_elaboracion: "",
        fecha_vencimiento: "",
        observaciones: "",
      },
    ]);
  }

  function actualizarProducto(idx, cambios) {
    setCarrito((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...cambios } : it))
    );
  }

  function quitarProducto(idx) {
    setCarrito((prev) => prev.filter((_, i) => i !== idx));
  }

  function validarGeneral() {
    const next = {};
    if (!idDeposito) next.idDeposito = "Elegí un depósito.";
    if (!idCompra) next.idCompra = "Elegí una compra.";
    setErrores((prev) => ({ ...prev, ...next }));
    return Object.keys(next).length === 0;
  }

  const filasInvalidas = carrito.filter((r) => {
    if (!(Number(r.cantidad) > 0)) return true;
    if (
      r.fecha_elaboracion &&
      r.fecha_vencimiento &&
      r.fecha_vencimiento <= r.fecha_elaboracion
    ) {
      return true;
    }
    return false;
  });

  function registrar() {
    setErrorServer(null);
    if (!validarGeneral()) return;
    if (carrito.length === 0) return;
    if (filasInvalidas.length > 0) {
      setErrorServer(
        "Revisá los productos del lote: la cantidad debe ser mayor a cero y el vencimiento posterior a la elaboración."
      );
      return;
    }

    startTransition(async () => {
      const result = await registrarIngresoPorCompra({
        id_compra: idCompra,
        id_deposito: idDeposito,
        detalle_lote: detalleLote.trim() || null,
        productos: carrito.map((r) => ({
          id_producto: r.id_producto,
          cantidad: Number(r.cantidad) || 0,
          fecha_elaboracion: r.fecha_elaboracion || null,
          fecha_vencimiento: r.fecha_vencimiento || null,
          observaciones: r.observaciones.trim() || null,
        })),
      });

      if (!result.ok) {
        setErrorServer(mapErrorLote(result).message);
        return;
      }
      router.push("/inventario/stock/lotes");
      router.refresh();
    });
  }

  const puedeRegistrar =
    !pending &&
    carrito.length > 0 &&
    idDeposito &&
    idCompra &&
    filasInvalidas.length === 0;

  return (
    <>
      {/* Datos generales del lote */}
      <div className="palacio-card p-5 md:p-6">
        <h2 className="mb-4 text-sm font-semibold text-zinc-900">
          Datos del lote
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Campo label="Depósito" error={errores.idDeposito} requerido>
            <select
              value={idDeposito}
              onChange={(e) => {
                setIdDeposito(e.target.value);
                setErrores((prev) => ({ ...prev, idDeposito: null }));
              }}
              className="palacio-input"
            >
              <option value="">Seleccioná un depósito…</option>
              {depositos.map((d) => (
                <option key={d.id_deposito} value={d.id_deposito}>
                  {d.nombre_deposito}
                </option>
              ))}
            </select>
          </Campo>

          <Campo label="Compra" error={errores.idCompra} requerido>
            <select
              value={idCompra}
              onChange={(e) => {
                setIdCompra(e.target.value);
                setErrores((prev) => ({ ...prev, idCompra: null }));
              }}
              disabled={sinCompras}
              className="palacio-input"
            >
              <option value="">Seleccioná una compra…</option>
              {compras.map((c) => (
                <option key={c.id_compra} value={c.id_compra}>
                  {c.nombre_proveedor} —{" "}
                  {c.total ? monedaFmt.format(Number(c.total)) : "sin total"}
                </option>
              ))}
            </select>
            {sinCompras ? (
              <p className="text-xs text-red-600">
                No hay compras pendientes de recepción.
              </p>
            ) : null}
          </Campo>

          <Campo label="Detalle del lote (opcional)" full>
            <textarea
              value={detalleLote}
              onChange={(e) => setDetalleLote(e.target.value)}
              rows={2}
              className="palacio-input"
              placeholder="Referencia, remito, observaciones generales…"
              maxLength={300}
            />
          </Campo>
        </div>
      </div>

      {/* Alta de producto */}
      <div className="palacio-card mt-6 p-5 md:p-6">
        <h2 className="mb-4 text-sm font-semibold text-zinc-900">
          Agregar producto
        </h2>
        <ProductoBuscadorLote
          onSeleccionar={agregarProducto}
          disabled={!idDeposito || !idCompra}
        />
        <p className="mt-1 text-xs text-palacio-muted">
          {!idDeposito || !idCompra
            ? "Elegí depósito y compra para poder buscar y agregar productos."
            : "La cantidad, las fechas y las observaciones se editan en la tabla de abajo."}
        </p>
      </div>

      {/* Productos del lote */}
      <div className="palacio-card mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">
            Productos del lote
          </h2>
          <span className="text-xs text-palacio-muted">
            {carrito.length} ítem{carrito.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="p-5">
          <CarritoLoteIngreso
            items={carrito}
            onActualizar={actualizarProducto}
            onQuitar={quitarProducto}
            vencimientoRequerido={false}
          />
        </div>

        {errorServer ? (
          <p className="mx-5 mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorServer}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t border-palacio-border px-5 py-4">
          <button
            type="button"
            onClick={registrar}
            disabled={!puedeRegistrar}
            className="palacio-btn-primary px-4 py-2.5 text-sm"
          >
            {pending ? "Registrando…" : "Registrar lote"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/inventario/stock/lotes")}
            disabled={pending}
            className="palacio-btn-secondary px-4 py-2.5 text-sm"
          >
            Cancelar
          </button>
        </div>
      </div>
    </>
  );
}

function Campo({ label, error, requerido = false, full = false, children }) {
  return (
    <div className={`flex flex-col gap-1.5 ${full ? "md:col-span-2" : ""}`}>
      <label className="text-sm font-medium text-zinc-800">
        {label} {requerido ? <span className="text-palacio-red">*</span> : null}
      </label>
      {children}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
