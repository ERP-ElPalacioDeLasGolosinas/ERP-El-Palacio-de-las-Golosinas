"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  registrarMovimientosLote,
  listarProductosPorDeposito,
  validarStockDisponible,
} from "@/lib/movimientos/actions";
import { mapErrorMovimiento } from "@/lib/movimientos/errores";
import { MovimientosLoteTable } from "./MovimientosLoteTable";

const TRANSFERENCIA_SENTINEL = "__transferencia__";

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

/**
 * Wizard de carga de movimientos (concepto → depósito → producto → [depósito
 * destino] → cantidad/remito) con carga múltiple: cada ítem completo se
 * agrega a una lista y se registra todo junto de forma atómica vía
 * `fn_movimiento_stock_registrar_lote`.
 *
 * @param {{
 *   tipos: Array<{ id_tipo_movimiento: string, nombre: string, signo: number, requiere_deposito_destino?: boolean }>,
 *   depositos: Array<{ id_deposito: string, nombre_deposito: string }>,
 *   movimientos: Array<{
 *     id_movimiento: string,
 *     fecha_movimiento: string,
 *     tipo_movimiento_nombre: string,
 *     producto_nombre_completo: string | null,
 *   }>,
 * }} props
 */
export function MovimientoForm({ tipos, depositos, movimientos }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // "ingreso por compra" se carga solo desde "Registrar lote"
  // (/inventario/stock/lotes/nuevo), no desde este wizard.
  const tiposSimples = useMemo(
    () =>
      tipos.filter(
        (t) =>
          !t.requiere_deposito_destino && t.nombre !== "ingreso por compra"
      ),
    [tipos]
  );
  const hayTransferencia = useMemo(
    () => tipos.some((t) => t.requiere_deposito_destino),
    [tipos]
  );

  const [idConcepto, setIdConcepto] = useState("");
  const [idDeposito, setIdDeposito] = useState("");
  const [idProducto, setIdProducto] = useState("");
  const [idDepositoDestino, setIdDepositoDestino] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [remito, setRemito] = useState("");
  const [corrige, setCorrige] = useState(false);
  const [idMovimientoReferencia, setIdMovimientoReferencia] = useState("");

  const [productos, setProductos] = useState([]);
  const [cargandoProductos, setCargandoProductos] = useState(false);
  const [stockInfo, setStockInfo] = useState(null);
  const [errores, setErrores] = useState({});
  const [errorServer, setErrorServer] = useState(null);
  const [carrito, setCarrito] = useState([]);

  const esTransferencia = idConcepto === TRANSFERENCIA_SENTINEL;
  const tipoElegido = useMemo(
    () => tiposSimples.find((t) => t.id_tipo_movimiento === idConcepto),
    [tiposSimples, idConcepto]
  );
  const signo = esTransferencia ? -1 : tipoElegido?.signo ?? null;
  const controlaStock = signo === -1;
  const depositosDestino = useMemo(
    () => depositos.filter((d) => d.id_deposito !== idDeposito),
    [depositos, idDeposito]
  );

  const depositoRequestRef = useRef(0);

  /**
   * Al cambiar el depósito: reset producto/stock, y trae el catálogo con
   * stock disponible en ese depósito (fn_producto_listar_por_deposito).
   */
  function onDepositoChange(valor) {
    setIdDeposito(valor);
    setIdProducto("");
    setStockInfo(null);
    setIdDepositoDestino((prev) => (prev === valor ? "" : prev));

    const requestId = ++depositoRequestRef.current;
    if (!valor) {
      setProductos([]);
      setCargandoProductos(false);
      return;
    }

    setCargandoProductos(true);
    listarProductosPorDeposito(valor).then((res) => {
      if (depositoRequestRef.current !== requestId) return;
      setCargandoProductos(false);
      setProductos(res.data ?? []);
    });
  }

  function onConceptoChange(valor) {
    setIdConcepto(valor);
    setIdDeposito("");
    setIdProducto("");
    setIdDepositoDestino("");
    setProductos([]);
    setCargandoProductos(false);
    setStockInfo(null);
    setCorrige(false);
    setIdMovimientoReferencia("");
    setErrores({});
  }

  async function chequearStock(prodId = idProducto, depId = idDeposito, cant = cantidad) {
    if (!controlaStock || !prodId || !depId) {
      setStockInfo(null);
      return;
    }
    const c = Number(cant) || 0;
    const res = await validarStockDisponible(prodId, depId, c);
    if (res.error) {
      setStockInfo(null);
      return;
    }
    setStockInfo({ stockActual: res.stockActual, alcanza: res.alcanza, cant: c });
  }

  function validar() {
    const next = {};
    if (!idConcepto) next.id_tipo_movimiento = "Elegí un concepto.";
    if (!idDeposito) next.id_deposito = "Elegí un depósito.";
    if (!idProducto) next.id_producto = "Elegí un producto.";
    if (esTransferencia && !idDepositoDestino) {
      next.id_deposito_destino = "Elegí el depósito destino.";
    }
    const cant = Number(cantidad);
    if (String(cantidad).trim() === "" || !Number.isFinite(cant) || cant <= 0) {
      next.cantidad = "La cantidad debe ser mayor a cero.";
    }
    if (!esTransferencia && corrige && !idMovimientoReferencia) {
      next.id_movimiento_referencia = "Elegí el movimiento a corregir.";
    }
    setErrores(next);
    return Object.keys(next).length === 0;
  }

  function agregarALaLista() {
    setErrorServer(null);
    if (!validar()) return;

    if (controlaStock && stockInfo && !stockInfo.alcanza) {
      setErrores((prev) => ({
        ...prev,
        cantidad: "Stock insuficiente para este movimiento.",
      }));
      return;
    }

    const nombreDeposito =
      depositos.find((d) => d.id_deposito === idDeposito)?.nombre_deposito ?? "";
    const nombreDepositoDestino = esTransferencia
      ? depositos.find((d) => d.id_deposito === idDepositoDestino)?.nombre_deposito ?? ""
      : null;
    const nombreProducto =
      productos.find((p) => p.id_producto === idProducto)?.nombre_completo ?? "";
    const nombreConcepto = esTransferencia
      ? "Transferencia de mercadería"
      : tipoElegido?.nombre ?? "";
    const remitoLimpio = remito.trim();
    const cantidadNum = Number(cantidad);

    const payload = esTransferencia
      ? {
          id_producto: idProducto,
          id_deposito: idDeposito,
          id_deposito_destino: idDepositoDestino,
          cantidad: cantidadNum,
          remito: remitoLimpio || null,
        }
      : {
          id_tipo_movimiento: idConcepto,
          id_producto: idProducto,
          id_deposito: idDeposito,
          cantidad: cantidadNum,
          remito: remitoLimpio || null,
          ...(corrige && idMovimientoReferencia
            ? { id_movimiento_referencia: idMovimientoReferencia }
            : {}),
        };

    setCarrito((prev) => [
      ...prev,
      {
        clientId: crearId(),
        esTransferencia,
        nombreConcepto,
        nombreDeposito,
        nombreDepositoDestino,
        nombreProducto,
        cantidad: cantidadNum,
        remito: remitoLimpio,
        payload,
      },
    ]);

    // Resetea Producto/Depósito destino/Cantidad/Remito; deja Concepto y
    // Depósito origen fijos por comodidad, pero siguen editables.
    setIdProducto("");
    setIdDepositoDestino("");
    setCantidad("");
    setRemito("");
    setCorrige(false);
    setIdMovimientoReferencia("");
    setStockInfo(null);
    setErrores({});
  }

  function quitarDeLaLista(clientId) {
    setCarrito((prev) => prev.filter((item) => item.clientId !== clientId));
  }

  function registrarLote() {
    setErrorServer(null);
    startTransition(async () => {
      const result = await registrarMovimientosLote(
        carrito.map((item) => item.payload)
      );
      if (!result.ok) {
        setErrorServer(mapErrorMovimiento(result).message);
        return;
      }
      router.push("/inventario/movimientos");
      router.refresh();
    });
  }

  return (
    <>
      <div className="palacio-card max-w-2xl p-5 md:p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Campo label="Concepto" error={errores.id_tipo_movimiento} requerido full>
            <select
              value={idConcepto}
              onChange={(e) => onConceptoChange(e.target.value)}
              className="palacio-input"
            >
              <option value="">Seleccioná un concepto…</option>
              {tiposSimples.map((t) => (
                <option key={t.id_tipo_movimiento} value={t.id_tipo_movimiento}>
                  {t.nombre} ({t.signo === 1 ? "+ suma" : "− resta"})
                </option>
              ))}
              {hayTransferencia ? (
                <option value={TRANSFERENCIA_SENTINEL}>
                  Transferencia de mercadería
                </option>
              ) : null}
            </select>
            {signo != null ? (
              <p
                className={`text-xs font-medium ${signo === 1 ? "text-green-600" : "text-red-600"}`}
              >
                {esTransferencia
                  ? "Resta stock del depósito origen y suma en el destino."
                  : signo === 1
                    ? "Este concepto suma stock."
                    : "Este concepto resta stock."}
              </p>
            ) : null}
            <p className="text-xs text-palacio-muted">
              ¿Necesitás cargar mercadería de una compra?{" "}
              <Link
                href="/inventario/stock/lotes/nuevo"
                className="text-palacio-red hover:underline"
              >
                Registrar lote
              </Link>
              .
            </p>
          </Campo>

          <Campo
            label={esTransferencia ? "Depósito origen" : "Depósito"}
            error={errores.id_deposito}
            requerido
            full={!esTransferencia}
          >
            <select
              value={idDeposito}
              onChange={(e) => onDepositoChange(e.target.value)}
              disabled={!idConcepto}
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

          {esTransferencia ? (
            <Campo
              label="Depósito destino"
              error={errores.id_deposito_destino}
              requerido
            >
              <select
                value={idDepositoDestino}
                onChange={(e) => setIdDepositoDestino(e.target.value)}
                disabled={!idDeposito}
                className="palacio-input"
              >
                <option value="">Seleccioná un depósito…</option>
                {depositosDestino.map((d) => (
                  <option key={d.id_deposito} value={d.id_deposito}>
                    {d.nombre_deposito}
                  </option>
                ))}
              </select>
            </Campo>
          ) : null}

          <Campo label="Producto" error={errores.id_producto} requerido full>
            <select
              value={idProducto}
              onChange={(e) => {
                const valor = e.target.value;
                setIdProducto(valor);
                setErrores((prev) => ({ ...prev, id_producto: null }));
                chequearStock(valor, idDeposito, cantidad);
              }}
              disabled={!idDeposito || cargandoProductos}
              className="palacio-input"
            >
              <option value="">
                {cargandoProductos ? "Cargando productos…" : "Seleccioná un producto…"}
              </option>
              {productos.map((p) => (
                <option key={p.id_producto} value={p.id_producto}>
                  {p.nombre_completo} — {numFmt.format(Number(p.cantidad_disponible ?? 0))} disp.
                </option>
              ))}
            </select>
            {idDeposito && !cargandoProductos && productos.length === 0 ? (
              <p className="text-xs text-palacio-muted">
                Este depósito no tiene productos con stock disponible.
              </p>
            ) : null}
          </Campo>

          <Campo label="Cantidad" error={errores.cantidad} requerido>
            <input
              type="number"
              step="any"
              min="0"
              value={cantidad}
              onChange={(e) => {
                setCantidad(e.target.value);
                setErrores((prev) => ({ ...prev, cantidad: null }));
              }}
              onBlur={() => chequearStock()}
              disabled={!idProducto}
              className="palacio-input"
              placeholder="0"
            />
            {controlaStock && stockInfo ? (
              <p
                className={`text-xs ${stockInfo.alcanza ? "text-palacio-muted" : "text-red-600"}`}
              >
                Stock disponible: {numFmt.format(stockInfo.stockActual ?? 0)}
                {!stockInfo.alcanza ? " — no alcanza para este movimiento." : ""}
              </p>
            ) : null}
          </Campo>

          <Campo label="Remito (opcional)">
            <input
              type="text"
              value={remito}
              onChange={(e) => setRemito(e.target.value)}
              disabled={!idProducto}
              className="palacio-input"
              placeholder="N.º de remito / comprobante"
              maxLength={80}
            />
          </Campo>

          {!esTransferencia ? (
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={corrige}
                  onChange={(e) => setCorrige(e.target.checked)}
                  disabled={!idProducto}
                  className="size-4 accent-palacio-red"
                />
                ¿Corrige un movimiento existente?
              </label>
              {corrige ? (
                <Campo
                  label="Movimiento a corregir"
                  error={errores.id_movimiento_referencia}
                >
                  <select
                    value={idMovimientoReferencia}
                    onChange={(e) => setIdMovimientoReferencia(e.target.value)}
                    className="palacio-input"
                  >
                    <option value="">Seleccioná el movimiento original…</option>
                    {movimientos.map((m) => (
                      <option key={m.id_movimiento} value={m.id_movimiento}>
                        {fechaFmt.format(new Date(`${m.fecha_movimiento}T00:00:00`))} —{" "}
                        {m.tipo_movimiento_nombre}
                        {m.producto_nombre_completo
                          ? ` — ${m.producto_nombre_completo}`
                          : ""}
                      </option>
                    ))}
                  </select>
                  {movimientos.length === 0 ? (
                    <p className="text-xs text-palacio-muted">
                      No hay movimientos previos para referenciar.
                    </p>
                  ) : null}
                </Campo>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap gap-2 border-t border-palacio-border pt-4">
          <button
            type="button"
            onClick={agregarALaLista}
            className="palacio-btn-secondary px-4 py-2.5 text-sm"
          >
            Agregar a la lista
          </button>
          <button
            type="button"
            onClick={() => router.push("/inventario/movimientos")}
            disabled={pending}
            className="palacio-btn-secondary px-4 py-2.5 text-sm"
          >
            Cancelar
          </button>
        </div>
      </div>

      <MovimientosLoteTable
        items={carrito}
        onQuitar={quitarDeLaLista}
        onRegistrar={registrarLote}
        pending={pending}
        errorServer={errorServer}
      />
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
