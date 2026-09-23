"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { listarProductosPorDeposito } from "@/lib/movimientos/actions";
import { registrarVenta } from "@/lib/ventas/actions";
import { mapErrorVenta } from "@/lib/ventas/errores";

const monedaFmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

const redondear = (n) => Math.round((Number(n) || 0) * 100) / 100;

let contadorLinea = 0;
function nuevaLinea(base = {}) {
  contadorLinea += 1;
  return {
    key: `l${contadorLinea}`,
    id_deposito: base.id_deposito ?? "",
    id_producto: "",
    cantidad: "",
    descuento: "",
  };
}

/**
 * V-10 / V-11 / S-07 · Registro de una venta mayorista. Cada línea elige
 * depósito → artículo con stock en ese depósito → cantidad. El precio es el
 * mayorista del artículo y lo vuelve a tomar la base al confirmar.
 *
 * @param {{
 *   clientes: Array<{ id_cliente: string, nombre_cliente: string, documento_cliente: string | null }>,
 *   tipos: Array<{ id_tipo_comprobante: string, nombre_tipo_comprobante: string, letra: string | null }>,
 *   depositos: Array<{ id_deposito: string, nombre_deposito: string }>,
 *   precios: Record<string, number>,
 * }} props
 */
export function VentaForm({ clientes, tipos, depositos, precios }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [idCliente, setIdCliente] = useState("");
  const [idTipo, setIdTipo] = useState(tipos[0]?.id_tipo_comprobante ?? "");
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [observaciones, setObservaciones] = useState("");
  const [lineas, setLineas] = useState(() => [
    nuevaLinea({ id_deposito: depositos.length === 1 ? depositos[0].id_deposito : "" }),
  ]);

  /** Productos con stock por depósito: `{ [id_deposito]: Array | "cargando" }`. */
  const [productosPorDeposito, setProductosPorDeposito] = useState({});
  const [errores, setErrores] = useState({});
  const [errorServer, setErrorServer] = useState(null);

  function limpiarErrores() {
    setErrores({});
    setErrorServer(null);
  }

  function cargarProductos(idDeposito) {
    if (!idDeposito || productosPorDeposito[idDeposito]) return;
    setProductosPorDeposito((prev) => ({ ...prev, [idDeposito]: "cargando" }));
    startTransition(async () => {
      const res = await listarProductosPorDeposito(idDeposito);
      setProductosPorDeposito((prev) => ({ ...prev, [idDeposito]: res.data ?? [] }));
    });
  }

  const depositoInicial = depositos.length === 1 ? depositos[0].id_deposito : "";
  useEffect(() => {
    if (!depositoInicial) return;
    let cancelado = false;
    listarProductosPorDeposito(depositoInicial).then((res) => {
      if (cancelado) return;
      setProductosPorDeposito((prev) =>
        prev[depositoInicial] ? prev : { ...prev, [depositoInicial]: res.data ?? [] }
      );
    });
    return () => {
      cancelado = true;
    };
  }, [depositoInicial]);

  function setLinea(idx, cambios) {
    setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...cambios } : l)));
    limpiarErrores();
  }

  function elegirDeposito(idx, idDeposito) {
    setLinea(idx, { id_deposito: idDeposito, id_producto: "" });
    cargarProductos(idDeposito);
  }

  function agregarLinea() {
    const ultimo = lineas[lineas.length - 1]?.id_deposito ?? "";
    setLineas((prev) => [...prev, nuevaLinea({ id_deposito: ultimo })]);
  }

  function quitarLinea(idx) {
    setLineas((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));
    limpiarErrores();
  }

  function productosDe(idDeposito) {
    const lista = productosPorDeposito[idDeposito];
    return Array.isArray(lista) ? lista : [];
  }

  function disponibleDe(linea) {
    const p = productosDe(linea.id_deposito).find((x) => x.id_producto === linea.id_producto);
    return p ? Number(p.cantidad_disponible) || 0 : null;
  }

  /** Cantidad pedida por producto × depósito en todas las líneas. */
  const pedidoPorClave = useMemo(() => {
    const acc = {};
    for (const l of lineas) {
      if (!l.id_producto || !l.id_deposito) continue;
      const k = `${l.id_producto}|${l.id_deposito}`;
      acc[k] = (acc[k] ?? 0) + (Number(l.cantidad) || 0);
    }
    return acc;
  }, [lineas]);

  const calculadas = lineas.map((l) => {
    const precio = l.id_producto ? Number(precios[l.id_producto]) || 0 : 0;
    const cantidad = Number(l.cantidad) || 0;
    const descuento = Number(l.descuento) || 0;
    const bruto = redondear(precio * cantidad);
    return { precio, bruto, descuento, importe: redondear(bruto - descuento) };
  });

  const subtotal = redondear(calculadas.reduce((a, c) => a + c.bruto, 0));
  const descuentoTotal = redondear(calculadas.reduce((a, c) => a + c.descuento, 0));
  const total = redondear(subtotal - descuentoTotal);

  function validar() {
    const next = {};
    if (!idCliente) next.cliente = "Elegí un cliente mayorista.";
    if (!idTipo) next.tipo = "Elegí el tipo de comprobante.";
    if (!fecha) next.fecha = "La fecha es obligatoria.";
    else if (fecha > new Date().toISOString().slice(0, 10))
      next.fecha = "La fecha no puede ser futura.";

    for (const [idx, l] of lineas.entries()) {
      if (!l.id_deposito || !l.id_producto || !(Number(l.cantidad) > 0)) {
        next.detalle = "Cada línea necesita depósito, artículo y cantidad mayor a cero.";
        break;
      }
      if (Number(l.descuento) < 0) {
        next.detalle = "El descuento no puede ser negativo.";
        break;
      }
      if (calculadas[idx].descuento > calculadas[idx].bruto) {
        next.detalle = "El descuento de una línea no puede superar su importe.";
        break;
      }
      const disponible = disponibleDe(l);
      const pedido = pedidoPorClave[`${l.id_producto}|${l.id_deposito}`] ?? 0;
      if (disponible != null && pedido > disponible) {
        const p = productosDe(l.id_deposito).find((x) => x.id_producto === l.id_producto);
        next.detalle = `Stock insuficiente de ${p?.nombre_completo ?? "un artículo"}: disponible ${disponible}, pedido ${pedido}.`;
        break;
      }
    }
    if (!next.detalle && total <= 0) next.detalle = "El total de la venta tiene que ser mayor a cero.";

    setErrores(next);
    return Object.keys(next).length === 0;
  }

  function enviar() {
    setErrorServer(null);
    if (!validar()) return;

    startTransition(async () => {
      const result = await registrarVenta({
        id_cliente: idCliente,
        id_tipo_comprobante: idTipo,
        fecha_comprobante: fecha,
        observaciones,
        detalle: lineas.map((l) => ({
          id_producto: l.id_producto,
          id_deposito: l.id_deposito,
          cantidad: Number(l.cantidad),
          descuento: Number(l.descuento) || 0,
        })),
      });

      if (!result.ok) {
        const ui = mapErrorVenta(result);
        if (ui.field) setErrores((prev) => ({ ...prev, [ui.field]: ui.message }));
        else setErrorServer(ui.message);
        if (ui.reload) {
          setProductosPorDeposito({});
          router.refresh();
        }
        return;
      }

      router.push(result.id ? `/ventas/ordenes/${result.id}` : "/ventas/ordenes");
      router.refresh();
    });
  }

  return (
    <>
      <div className="palacio-card p-5 md:p-6">
        <h2 className="mb-4 text-sm font-semibold text-zinc-900">Datos de la venta</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Campo label="Cliente mayorista" requerido error={errores.cliente}>
            <select
              value={idCliente}
              onChange={(e) => {
                setIdCliente(e.target.value);
                limpiarErrores();
              }}
              className="palacio-input"
            >
              <option value="">Elegí un cliente…</option>
              {clientes.map((c) => (
                <option key={c.id_cliente} value={c.id_cliente}>
                  {c.nombre_cliente}
                  {c.documento_cliente ? ` · ${c.documento_cliente}` : ""}
                </option>
              ))}
            </select>
            {clientes.length === 0 ? (
              <p className="text-xs text-amber-700">
                No hay clientes mayoristas activos. Cargalos en Clientes.
              </p>
            ) : null}
          </Campo>

          <Campo label="Comprobante" requerido error={errores.tipo}>
            <select
              value={idTipo}
              onChange={(e) => {
                setIdTipo(e.target.value);
                limpiarErrores();
              }}
              className="palacio-input"
            >
              <option value="">Elegí el tipo…</option>
              {tipos.map((t) => (
                <option key={t.id_tipo_comprobante} value={t.id_tipo_comprobante}>
                  {t.nombre_tipo_comprobante}
                </option>
              ))}
            </select>
            <p className="text-xs text-palacio-muted">El número se asigna automáticamente.</p>
          </Campo>

          <Campo label="Fecha" requerido error={errores.fecha}>
            <input
              type="date"
              value={fecha}
              onChange={(e) => {
                setFecha(e.target.value);
                limpiarErrores();
              }}
              className="palacio-input"
            />
          </Campo>

          <div className="md:col-span-3">
            <Campo label="Observaciones">
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={2}
                maxLength={500}
                className="palacio-input"
              />
            </Campo>
          </div>
        </div>
      </div>

      <div className="palacio-card mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">Artículos</h2>
          <span className="text-xs text-palacio-muted">
            Precio mayorista · el stock se descuenta al confirmar
          </span>
        </div>

        <div className="space-y-3 p-4">
          {lineas.map((l, idx) => {
            const lista = productosPorDeposito[l.id_deposito];
            const cargando = lista === "cargando";
            const productos = productosDe(l.id_deposito);
            const disponible = disponibleDe(l);
            const calc = calculadas[idx];
            return (
              <div
                key={l.key}
                className="grid gap-3 rounded-lg border border-palacio-border p-3 md:grid-cols-[1fr_1.6fr_7rem_8rem_auto]"
              >
                <select
                  value={l.id_deposito}
                  onChange={(e) => elegirDeposito(idx, e.target.value)}
                  className="palacio-input"
                >
                  <option value="">Depósito…</option>
                  {depositos.map((d) => (
                    <option key={d.id_deposito} value={d.id_deposito}>
                      {d.nombre_deposito}
                    </option>
                  ))}
                </select>

                <div>
                  <select
                    value={l.id_producto}
                    onChange={(e) => setLinea(idx, { id_producto: e.target.value })}
                    disabled={!l.id_deposito || cargando}
                    className="palacio-input"
                  >
                    <option value="">
                      {cargando ? "Cargando artículos…" : "Artículo…"}
                    </option>
                    {productos.map((p) => (
                      <option key={p.id_producto} value={p.id_producto}>
                        {p.codigo_producto} · {p.nombre_completo}
                      </option>
                    ))}
                  </select>
                  {l.id_deposito && !cargando && productos.length === 0 ? (
                    <p className="mt-1 text-xs text-amber-700">
                      Ese depósito no tiene artículos con stock.
                    </p>
                  ) : null}
                  {l.id_producto ? (
                    <p className="mt-1 text-xs text-palacio-muted">
                      Disponible: {disponible ?? "—"} · Precio {monedaFmt.format(calc.precio)} ·
                      Importe {monedaFmt.format(calc.importe)}
                    </p>
                  ) : null}
                </div>

                <input
                  type="number"
                  min="0"
                  step="1"
                  value={l.cantidad}
                  onChange={(e) => setLinea(idx, { cantidad: e.target.value })}
                  className="palacio-input text-right"
                  placeholder="Cantidad"
                />

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={l.descuento}
                  onChange={(e) => setLinea(idx, { descuento: e.target.value })}
                  className="palacio-input text-right"
                  placeholder="Descuento $"
                />

                <button
                  type="button"
                  onClick={() => quitarLinea(idx)}
                  disabled={lineas.length === 1}
                  className="palacio-action-btn palacio-action-danger self-start"
                >
                  Quitar
                </button>
              </div>
            );
          })}
        </div>

        {errores.detalle ? (
          <p className="mx-5 mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errores.detalle}
          </p>
        ) : null}

        <div className="flex flex-wrap items-start justify-between gap-3 border-t border-palacio-border px-5 py-3">
          <button
            type="button"
            onClick={agregarLinea}
            className="palacio-btn-secondary px-3 py-2 text-sm"
          >
            Agregar artículo
          </button>
          <dl className="space-y-0.5 text-right text-sm">
            <div>
              <dt className="inline text-palacio-muted">Subtotal: </dt>
              <dd className="inline text-zinc-900">{monedaFmt.format(subtotal)}</dd>
            </div>
            <div>
              <dt className="inline text-palacio-muted">Descuentos: </dt>
              <dd className="inline text-zinc-900">{monedaFmt.format(descuentoTotal)}</dd>
            </div>
            <div>
              <dt className="inline text-palacio-muted">Total: </dt>
              <dd className="inline font-semibold text-zinc-900">{monedaFmt.format(total)}</dd>
            </div>
          </dl>
        </div>
      </div>

      {errorServer ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorServer}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={enviar}
          disabled={pending}
          className="palacio-btn-primary px-4 py-2.5 text-sm"
        >
          {pending ? "Registrando…" : "Registrar venta"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/ventas/ordenes")}
          disabled={pending}
          className="palacio-btn-secondary px-4 py-2.5 text-sm"
        >
          Cancelar
        </button>
      </div>
    </>
  );
}

function Campo({ label, requerido = false, error, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-zinc-800">
        {label} {requerido ? <span className="text-palacio-red">*</span> : null}
      </label>
      {children}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
