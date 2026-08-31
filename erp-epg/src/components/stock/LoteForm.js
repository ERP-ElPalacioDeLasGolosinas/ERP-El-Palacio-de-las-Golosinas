"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registrarLote } from "@/lib/stock/actions";
import { mapErrorLote } from "@/lib/stock/errores";

const numFmt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
const fechaFmt = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function crearId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function formatFecha(valor) {
  if (!valor) return "—";
  const d = new Date(`${valor}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "—" : fechaFmt.format(d);
}

const ITEM_VACIO = {
  idProducto: "",
  cantidad: "",
  fechaElaboracion: "",
  fechaVencimiento: "",
  observaciones: "",
};

/**
 * Alta de un lote: datos generales una vez (depósito, proveedor, detalle) y N
 * productos cargados a una lista antes de registrar todo junto vía
 * `fn_lote_registrar_completo`.
 *
 * @param {{
 *   depositos: Array<{ id_deposito: string, nombre_deposito: string }>,
 *   proveedores: Array<{ id_proveedor: string, nombre_proveedor: string }>,
 *   productos: Array<{ id_producto: string, nombre_completo: string }>,
 * }} props
 */
export function LoteForm({ depositos, proveedores, productos }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [idDeposito, setIdDeposito] = useState("");
  const [idProveedor, setIdProveedor] = useState("");
  const [detalleLote, setDetalleLote] = useState("");

  const [item, setItem] = useState(ITEM_VACIO);
  const [carrito, setCarrito] = useState([]);
  const [errores, setErrores] = useState({});
  const [errorServer, setErrorServer] = useState(null);

  const sinProveedores = proveedores.length === 0;

  const nombreProducto = useMemo(() => {
    const map = new Map(productos.map((p) => [p.id_producto, p.nombre_completo]));
    return (id) => map.get(id) ?? "";
  }, [productos]);

  function setCampoItem(campo, valor) {
    setItem((prev) => ({ ...prev, [campo]: valor }));
    setErrores((prev) => ({ ...prev, [campo]: null }));
  }

  function validarItem() {
    const next = {};
    if (!item.idProducto) next.idProducto = "Elegí un producto.";
    const cant = Number(item.cantidad);
    if (
      String(item.cantidad).trim() === "" ||
      !Number.isFinite(cant) ||
      cant <= 0
    ) {
      next.cantidad = "La cantidad debe ser mayor a cero.";
    }
    if (
      item.fechaElaboracion &&
      item.fechaVencimiento &&
      item.fechaVencimiento <= item.fechaElaboracion
    ) {
      next.fechaVencimiento =
        "El vencimiento debe ser posterior a la fecha de elaboración.";
    }
    setErrores(next);
    return Object.keys(next).length === 0;
  }

  function agregarProducto() {
    setErrorServer(null);
    if (!validarItem()) return;

    setCarrito((prev) => [
      ...prev,
      {
        clientId: crearId(),
        idProducto: item.idProducto,
        nombreProducto: nombreProducto(item.idProducto),
        cantidad: Number(item.cantidad),
        fechaElaboracion: item.fechaElaboracion || null,
        fechaVencimiento: item.fechaVencimiento || null,
        observaciones: item.observaciones.trim(),
      },
    ]);
    setItem(ITEM_VACIO);
    setErrores({});
  }

  function quitarProducto(clientId) {
    setCarrito((prev) => prev.filter((r) => r.clientId !== clientId));
  }

  function validarGeneral() {
    const next = {};
    if (!idDeposito) next.idDeposito = "Elegí un depósito.";
    if (!idProveedor) next.idProveedor = "Elegí un proveedor.";
    setErrores((prev) => ({ ...prev, ...next }));
    return Object.keys(next).length === 0;
  }

  function registrar() {
    setErrorServer(null);
    if (!validarGeneral()) return;
    if (carrito.length === 0) return;

    startTransition(async () => {
      const result = await registrarLote({
        idDeposito,
        idProveedor,
        detalleLote,
        productos: carrito.map((r) => ({
          id_producto: r.idProducto,
          cantidad: r.cantidad,
          fecha_elaboracion: r.fechaElaboracion,
          fecha_vencimiento: r.fechaVencimiento,
          observaciones: r.observaciones || null,
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
    !pending && carrito.length > 0 && idDeposito && idProveedor;

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

          <Campo label="Proveedor" error={errores.idProveedor} requerido>
            <select
              value={idProveedor}
              onChange={(e) => {
                setIdProveedor(e.target.value);
                setErrores((prev) => ({ ...prev, idProveedor: null }));
              }}
              disabled={sinProveedores}
              className="palacio-input"
            >
              <option value="">Seleccioná un proveedor…</option>
              {proveedores.map((p) => (
                <option key={p.id_proveedor} value={p.id_proveedor}>
                  {p.nombre_proveedor}
                </option>
              ))}
            </select>
            {sinProveedores ? (
              <p className="text-xs text-red-600">
                No hay proveedores cargados. Cargá uno antes de registrar un lote.
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
        <div className="grid gap-4 md:grid-cols-2">
          <Campo label="Producto" error={errores.idProducto} requerido full>
            <select
              value={item.idProducto}
              onChange={(e) => setCampoItem("idProducto", e.target.value)}
              className="palacio-input"
            >
              <option value="">Seleccioná un producto…</option>
              {productos.map((p) => (
                <option key={p.id_producto} value={p.id_producto}>
                  {p.nombre_completo}
                </option>
              ))}
            </select>
          </Campo>

          <Campo label="Cantidad" error={errores.cantidad} requerido>
            <input
              type="number"
              step="any"
              min="0"
              value={item.cantidad}
              onChange={(e) => setCampoItem("cantidad", e.target.value)}
              className="palacio-input"
              placeholder="0"
            />
          </Campo>

          <div className="hidden md:block" />

          <Campo label="Fecha de elaboración">
            <input
              type="date"
              value={item.fechaElaboracion}
              onChange={(e) => setCampoItem("fechaElaboracion", e.target.value)}
              className="palacio-input"
            />
          </Campo>

          <Campo label="Fecha de vencimiento" error={errores.fechaVencimiento}>
            <input
              type="date"
              value={item.fechaVencimiento}
              onChange={(e) => setCampoItem("fechaVencimiento", e.target.value)}
              className="palacio-input"
            />
          </Campo>

          <Campo label="Observaciones (opcional)" full>
            <input
              type="text"
              value={item.observaciones}
              onChange={(e) => setCampoItem("observaciones", e.target.value)}
              className="palacio-input"
              placeholder="Detalle puntual de este producto en el lote"
              maxLength={200}
            />
          </Campo>
        </div>

        <div className="mt-5 border-t border-palacio-border pt-4">
          <button
            type="button"
            onClick={agregarProducto}
            className="palacio-btn-secondary px-4 py-2.5 text-sm"
          >
            Agregar producto
          </button>
        </div>
      </div>

      {/* Lista de productos del lote */}
      <div className="palacio-card mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">
            Productos del lote
          </h2>
          <span className="text-xs text-palacio-muted">
            {carrito.length} ítem{carrito.length === 1 ? "" : "s"}
          </span>
        </div>

        {carrito.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-palacio-muted">
            Todavía no agregaste ningún producto al lote.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-palacio-border bg-zinc-50/80">
                  <Th>Producto</Th>
                  <Th className="text-right">Cantidad</Th>
                  <Th>Elaboración</Th>
                  <Th>Vencimiento</Th>
                  <Th>Observaciones</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {carrito.map((r) => (
                  <tr
                    key={r.clientId}
                    className="border-b border-palacio-border last:border-0"
                  >
                    <td className="px-5 py-3 align-middle font-medium text-zinc-900">
                      {r.nombreProducto}
                    </td>
                    <td className="px-5 py-3 text-right align-middle tabular-nums text-zinc-900">
                      {numFmt.format(r.cantidad)}
                    </td>
                    <td className="px-5 py-3 align-middle text-palacio-muted">
                      {formatFecha(r.fechaElaboracion)}
                    </td>
                    <td className="px-5 py-3 align-middle text-palacio-muted">
                      {formatFecha(r.fechaVencimiento)}
                    </td>
                    <td className="px-5 py-3 align-middle text-palacio-muted">
                      {r.observaciones || "—"}
                    </td>
                    <td className="px-5 py-3 text-right align-middle">
                      <button
                        type="button"
                        onClick={() => quitarProducto(r.clientId)}
                        disabled={pending}
                        className="text-xs font-medium text-palacio-red hover:underline disabled:opacity-50"
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

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

function Th({ children, className = "" }) {
  return (
    <th
      className={`px-5 py-3 text-[11px] font-semibold tracking-wider text-palacio-muted uppercase ${className}`}
    >
      {children}
    </th>
  );
}
