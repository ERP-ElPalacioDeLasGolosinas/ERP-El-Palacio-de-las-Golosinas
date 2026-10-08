"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TIPOS_MEDIO_TESORERIA } from "@/lib/cajas/constantes";
import { listarCuentasCompatibles } from "@/lib/medios-pago/actions";
import { listarProductosPorDeposito } from "@/lib/movimientos/actions";
import { registrarVenta } from "@/lib/ventas/actions";
import { mapErrorVenta } from "@/lib/ventas/errores";
import { TIPOS_VENTA, listaDeTipoVenta, seCobraEnCaja } from "@/lib/ventas/estado";

const monedaFmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

const redondear = (n) => Math.round((Number(n) || 0) * 100) / 100;
const hoy = () => new Date().toISOString().slice(0, 10);

let contadorLinea = 0;
function nuevaLinea(base = {}) {
  contadorLinea += 1;
  return {
    key: `l${contadorLinea}`,
    id_deposito: base.id_deposito ?? "",
    id_producto: "",
    cantidad: "",
  };
}

let contadorMedio = 0;
function nuevoMedio(importe = "") {
  contadorMedio += 1;
  return {
    key: `m${contadorMedio}`,
    id_medio_pago: "",
    id_cuenta_tesoreria: "",
    importe: importe !== "" ? String(importe) : "",
    referencia: "",
    cuentas: [],
    cargandoCuentas: false,
  };
}

/**
 * V-10 / V-11 / V-21 / S-07 · Registro de una venta de cualquier tipo.
 * Cada línea elige depósito → artículo con stock en ese depósito (y precio en
 * la lista del tipo) → cantidad. El precio lo vuelve a tomar la base al
 * confirmar y el descuento es un % sobre el total.
 *
 * La mayorista nace "En preparación" y se cobra en Tesorería; la minorista y la
 * de consumidor final se cobran acá contra la caja abierta y quedan "Pagado".
 * Transferencia y cheque de terceros de esas ventas acreditan la cuenta de
 * tesorería vinculada al medio.
 *
 * @param {{
 *   clientes: Array<{ id_cliente: string, nombre_cliente: string, documento_cliente: string | null, lista_precio: string, es_consumidor_final: boolean }>,
 *   tipos: Array<{ id_tipo_comprobante: string, nombre_tipo_comprobante: string, letra: string | null }>,
 *   depositos: Array<{ id_deposito: string, nombre_deposito: string }>,
 *   listas: Record<string, { id_lista_precio: string, nombre_lista_precio: string, precios: Record<string, number> } | null>,
 *   medios: Array<{ id_medio_pago: string, nombre_medio_pago: string, tipo: string, requiere_referencia: boolean }>,
 *   cajasAbiertas: Array<{ id_caja: string, id_deposito: string, nombre_deposito: string, abierta_por_nombre: string, fecha_apertura: string, monto_inicial: number }>,
 * }} props
 */
export function VentaForm({ clientes, tipos, depositos, listas, medios, cajasAbiertas }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [tipoVenta, setTipoVenta] = useState(/** @type {"Mayorista" | "Minorista" | "Consumidor final"} */ ("Mayorista"));
  const [idCaja, setIdCaja] = useState(cajasAbiertas.length === 1 ? cajasAbiertas[0].id_caja : "");
  const [idCliente, setIdCliente] = useState("");
  const [idTipo, setIdTipo] = useState(tipos[0]?.id_tipo_comprobante ?? "");
  const [fecha, setFecha] = useState(hoy);
  const [observaciones, setObservaciones] = useState("");
  const [descuentoPct, setDescuentoPct] = useState("");
  const [lineas, setLineas] = useState(() => [
    nuevaLinea({ id_deposito: depositos.length === 1 ? depositos[0].id_deposito : "" }),
  ]);
  const [mediosPago, setMediosPago] = useState(() => [nuevoMedio()]);

  /** Productos con stock por depósito: `{ [id_deposito]: Array | "cargando" }`. */
  const [productosPorDeposito, setProductosPorDeposito] = useState({});
  const [errores, setErrores] = useState({});
  const [errorServer, setErrorServer] = useState(null);

  const enCaja = seCobraEnCaja(tipoVenta);
  const caja = cajasAbiertas.find((c) => c.id_caja === idCaja) ?? null;
  const tipoLista = listaDeTipoVenta(tipoVenta);
  const lista = listas?.[tipoLista] ?? null;
  const precios = useMemo(() => lista?.precios ?? {}, [lista]);

  const clientesDelTipo = clientes.filter((c) =>
    tipoVenta === "Mayorista"
      ? c.lista_precio === "Mayorista" && !c.es_consumidor_final
      : c.lista_precio === "Minorista" && !c.es_consumidor_final
  );

  function limpiarErrores() {
    setErrores({});
    setErrorServer(null);
  }

  function elegirTipo(tipo) {
    setTipoVenta(tipo);
    setIdCliente("");
    if (seCobraEnCaja(tipo)) {
      setFecha(hoy());
      setLineas((prev) => prev.map((l) => ({ ...l, id_producto: "" })));
    }
    limpiarErrores();
  }

  function elegirCaja(id) {
    setIdCaja(id);
    setLineas((prev) => prev.map((l) => ({ ...l, id_producto: "" })));
    const deposito = cajasAbiertas.find((c) => c.id_caja === id)?.id_deposito;
    if (deposito) cargarProductos(deposito);
    limpiarErrores();
  }

  /** En caja el depósito lo fija la caja; en mayorista lo elige cada línea. */
  function depositoDe(linea) {
    return enCaja ? (caja?.id_deposito ?? "") : linea.id_deposito;
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

  const depositoCaja = enCaja ? (caja?.id_deposito ?? "") : "";
  useEffect(() => {
    if (!depositoCaja) return;
    let cancelado = false;
    listarProductosPorDeposito(depositoCaja).then((res) => {
      if (cancelado) return;
      setProductosPorDeposito((prev) =>
        prev[depositoCaja] ? prev : { ...prev, [depositoCaja]: res.data ?? [] }
      );
    });
    return () => {
      cancelado = true;
    };
  }, [depositoCaja]);

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

  /** Artículos con stock en el depósito que además tienen precio en la lista. */
  function productosDe(idDeposito) {
    const stock = productosPorDeposito[idDeposito];
    return Array.isArray(stock) ? stock.filter((p) => p.id_producto in precios) : [];
  }

  function disponibleDe(linea) {
    const p = productosDe(linea.id_deposito).find((x) => x.id_producto === linea.id_producto);
    return p ? Number(p.cantidad_disponible) || 0 : null;
  }

  /** Cantidad pedida por producto × depósito en todas las líneas. */
  const pedidoPorClave = {};
  for (const l of lineas) {
    const deposito = depositoCaja || l.id_deposito;
    if (!l.id_producto || !deposito) continue;
    const k = `${l.id_producto}|${deposito}`;
    pedidoPorClave[k] = (pedidoPorClave[k] ?? 0) + (Number(l.cantidad) || 0);
  }

  const calculadas = lineas.map((l) => {
    const precio = l.id_producto ? Number(precios[l.id_producto]) || 0 : 0;
    const cantidad = Number(l.cantidad) || 0;
    return { precio, importe: redondear(precio * cantidad) };
  });

  const subtotal = redondear(calculadas.reduce((a, c) => a + c.importe, 0));
  const pct = Number(descuentoPct) || 0;
  const descuentoTotal = redondear((subtotal * pct) / 100);
  const total = redondear(subtotal - descuentoTotal);

  const totalMedios = redondear(mediosPago.reduce((a, m) => a + (Number(m.importe) || 0), 0));
  const diferenciaMedios = redondear(totalMedios - total);

  function setMedio(idx, cambios) {
    setMediosPago((prev) => prev.map((m, i) => (i === idx ? { ...m, ...cambios } : m)));
    limpiarErrores();
  }

  function acreditarEnTesoreria(idMedio) {
    const medio = medios.find((x) => x.id_medio_pago === idMedio);
    return TIPOS_MEDIO_TESORERIA.has(medio?.tipo);
  }

  function elegirMedioCobro(idx, idMedio) {
    const acredita = acreditarEnTesoreria(idMedio);
    setMedio(idx, {
      id_medio_pago: idMedio,
      id_cuenta_tesoreria: "",
      cuentas: [],
      cargandoCuentas: acredita,
    });
    if (!acredita) return;
    startTransition(async () => {
      const res = await listarCuentasCompatibles(idMedio);
      const cuentas = res.data ?? [];
      setMediosPago((prev) =>
        prev.map((l, i) =>
          i === idx
            ? {
                ...l,
                cuentas,
                cargandoCuentas: false,
                id_cuenta_tesoreria: cuentas.length === 1 ? cuentas[0].id_cuenta : "",
              }
            : l
        )
      );
    });
  }

  function agregarMedio() {
    const restante = redondear(total - totalMedios);
    setMediosPago((prev) => [...prev, nuevoMedio(restante > 0 ? restante : "")]);
  }

  function quitarMedio(idx) {
    setMediosPago((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));
    limpiarErrores();
  }

  function validar() {
    const next = {};
    if (!lista) next.detalle = `No hay una lista de precios ${tipoLista} vigente.`;
    if (enCaja && !caja) next.caja = "Elegí la caja en la que se cobra la venta.";
    if (tipoVenta !== "Consumidor final" && !idCliente) next.cliente = "Elegí un cliente.";
    if (!idTipo) next.tipo = "Elegí el tipo de comprobante.";
    if (!fecha) next.fecha = "La fecha es obligatoria.";
    else if (fecha > hoy()) next.fecha = "La fecha no puede ser futura.";
    else if (enCaja && fecha !== hoy()) next.fecha = "Las ventas que se cobran en caja se registran con la fecha del día.";

    if (descuentoPct !== "" && !(pct >= 0 && pct <= 100)) {
      next.descuento = "El descuento debe estar entre 0 y 100.";
    }

    for (const l of lineas) {
      const deposito = depositoDe(l);
      if (!deposito || !l.id_producto || !(Number(l.cantidad) > 0)) {
        next.detalle = enCaja
          ? "Cada línea necesita artículo y cantidad mayor a cero."
          : "Cada línea necesita depósito, artículo y cantidad mayor a cero.";
        break;
      }
      const disponible = disponibleDe({ ...l, id_deposito: deposito });
      const pedido = pedidoPorClave[`${l.id_producto}|${deposito}`] ?? 0;
      if (disponible != null && pedido > disponible) {
        const p = productosDe(deposito).find((x) => x.id_producto === l.id_producto);
        next.detalle = `Stock insuficiente de ${p?.nombre_completo ?? "un artículo"}: disponible ${disponible}, pedido ${pedido}.`;
        break;
      }
    }
    if (!next.detalle && !next.descuento && total <= 0) next.detalle = "El total de la venta tiene que ser mayor a cero.";

    if (enCaja && !next.detalle) {
      if (!caja) next.medios = "No hay una caja abierta para cobrar la venta.";
      for (const m of mediosPago) {
        if (!m.id_medio_pago || !(Number(m.importe) > 0)) {
          next.medios = "Cada medio necesita un medio de pago y un importe mayor a cero.";
          break;
        }
        const medio = medios.find((x) => x.id_medio_pago === m.id_medio_pago);
        if (medio?.requiere_referencia && !m.referencia.trim()) {
          next.medios = `El medio "${medio.nombre_medio_pago}" requiere una referencia.`;
          break;
        }
        if (acreditarEnTesoreria(m.id_medio_pago)) {
          if (m.cargandoCuentas) {
            next.medios = "Esperá a que carguen las cuentas del medio de pago.";
            break;
          }
          if ((m.cuentas?.length ?? 0) === 0) {
            next.medios = `El medio "${medio?.nombre_medio_pago ?? "elegido"}" no tiene una cuenta de tesorería activa asignada.`;
            break;
          }
          if (m.cuentas.length > 1 && !m.id_cuenta_tesoreria) {
            next.medios = `Elegí en qué cuenta se acredita "${medio?.nombre_medio_pago ?? "el medio"}".`;
            break;
          }
        }
      }
      if (!next.medios && diferenciaMedios !== 0) {
        next.medios = `La suma de los medios (${monedaFmt.format(totalMedios)}) tiene que ser igual al total de la venta (${monedaFmt.format(total)}).`;
      }
    }

    setErrores(next);
    return Object.keys(next).length === 0;
  }

  function enviar() {
    setErrorServer(null);
    if (!validar()) return;

    startTransition(async () => {
      const result = await registrarVenta({
        tipo_venta: tipoVenta,
        id_cliente: idCliente || null,
        id_tipo_comprobante: idTipo,
        fecha_comprobante: fecha,
        observaciones,
        descuento_porcentaje: pct,
        id_caja: enCaja ? caja?.id_caja : null,
        detalle: lineas.map((l) => ({
          id_producto: l.id_producto,
          id_deposito: depositoDe(l),
          cantidad: Number(l.cantidad),
        })),
        medios: enCaja
          ? mediosPago.map((m) => ({
              id_medio_pago: m.id_medio_pago,
              id_cuenta_tesoreria: acreditarEnTesoreria(m.id_medio_pago) ? m.id_cuenta_tesoreria || null : null,
              importe: Number(m.importe),
              referencia: m.referencia || null,
            }))
          : null,
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

        <div className="mb-4">
          <span className="text-sm font-medium text-zinc-800">
            Tipo de venta <span className="text-palacio-red">*</span>
          </span>
          <div className="mt-1.5 inline-flex flex-wrap rounded-lg border border-palacio-border p-0.5 text-sm">
            {TIPOS_VENTA.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => elegirTipo(t)}
                className={`rounded-md px-3 py-1.5 font-medium ${
                  tipoVenta === t ? "bg-zinc-900 text-white" : "text-palacio-muted hover:text-zinc-900"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-palacio-muted">
            {enCaja
              ? "Se cobra en la caja elegida, con el stock de su depósito, y queda pagada al confirmar. Precios de la lista Minorista."
              : "Queda en preparación: se despacha y se cobra después en Tesorería. Precios de la lista Mayorista."}
          </p>
        </div>

        {enCaja ? (
          cajasAbiertas.length === 0 ? (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              No hay una caja abierta con depósito asignado, así que esta venta no se puede cobrar.{" "}
              <Link href="/ventas/cajas" className="underline">
                Abrir caja
              </Link>
            </div>
          ) : (
            <div className="mb-4">
              <Campo label="Caja" requerido error={errores.caja}>
                <select
                  value={idCaja}
                  onChange={(e) => elegirCaja(e.target.value)}
                  className="palacio-input"
                >
                  <option value="">Elegí la caja…</option>
                  {cajasAbiertas.map((c) => (
                    <option key={c.id_caja} value={c.id_caja}>
                      {c.nombre_deposito} · {c.abierta_por_nombre}
                    </option>
                  ))}
                </select>
                {caja ? (
                  <p className="text-xs text-palacio-muted">
                    Los artículos salen de {caja.nombre_deposito}. No se puede elegir otro depósito.
                  </p>
                ) : null}
              </Campo>
            </div>
          )
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <Campo
            label={tipoVenta === "Consumidor final" ? "Cliente (opcional)" : `Cliente ${tipoVenta.toLowerCase()}`}
            requerido={tipoVenta !== "Consumidor final"}
            error={errores.cliente}
          >
            <select
              value={idCliente}
              onChange={(e) => {
                setIdCliente(e.target.value);
                limpiarErrores();
              }}
              className="palacio-input"
            >
              <option value="">
                {tipoVenta === "Consumidor final" ? "Consumidor final genérico" : "Elegí un cliente…"}
              </option>
              {clientesDelTipo.map((c) => (
                <option key={c.id_cliente} value={c.id_cliente}>
                  {c.nombre_cliente}
                  {c.documento_cliente ? ` · ${c.documento_cliente}` : ""}
                </option>
              ))}
            </select>
            {clientesDelTipo.length === 0 && tipoVenta !== "Consumidor final" ? (
              <p className="text-xs text-amber-700">
                No hay clientes {tipoVenta.toLowerCase()}s activos. Cargalos en Clientes.
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
              readOnly={enCaja}
              className="palacio-input"
            />
            {enCaja ? (
              <p className="text-xs text-palacio-muted">Se cobra en caja, así que la fecha es la del día.</p>
            ) : null}
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
            {lista ? `Lista: ${lista.nombre_lista_precio}` : `Sin lista ${tipoLista} vigente`} · el stock se
            descuenta al confirmar
          </span>
        </div>

        <div className="space-y-3 p-4">
          {lineas.map((l, idx) => {
            const deposito = depositoDe(l);
            const listaDeposito = productosPorDeposito[deposito];
            const cargando = listaDeposito === "cargando";
            const productos = productosDe(deposito);
            const disponible = disponibleDe({ ...l, id_deposito: deposito });
            const calc = calculadas[idx];
            return (
              <div
                key={l.key}
                className={`grid gap-3 rounded-lg border border-palacio-border p-3 ${
                  enCaja ? "md:grid-cols-[1.6fr_7rem_auto]" : "md:grid-cols-[1fr_1.6fr_7rem_auto]"
                }`}
              >
                {enCaja ? null : (
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
                )}

                <div>
                  <select
                    value={l.id_producto}
                    onChange={(e) => setLinea(idx, { id_producto: e.target.value })}
                    disabled={!deposito || cargando}
                    className="palacio-input"
                  >
                    <option value="">{cargando ? "Cargando artículos…" : "Artículo…"}</option>
                    {productos.map((p) => (
                      <option key={p.id_producto} value={p.id_producto}>
                        {p.codigo_producto} · {p.nombre_completo}
                      </option>
                    ))}
                  </select>
                  {deposito && !cargando && productos.length === 0 ? (
                    <p className="mt-1 text-xs text-amber-700">
                      Ese depósito no tiene artículos con stock y precio en la lista.
                    </p>
                  ) : null}
                  {l.id_producto ? (
                    <p className="mt-1 text-xs text-palacio-muted">
                      Disponible: {disponible ?? "—"} · Precio {monedaFmt.format(calc.precio)} · Importe{" "}
                      {monedaFmt.format(calc.importe)}
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
          <button type="button" onClick={agregarLinea} className="palacio-btn-secondary px-3 py-2 text-sm">
            Agregar artículo
          </button>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-800">Descuento %</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={descuentoPct}
              onChange={(e) => {
                setDescuentoPct(e.target.value);
                limpiarErrores();
              }}
              className="palacio-input w-28 text-right"
              placeholder="0"
            />
            {errores.descuento ? <p className="text-xs text-red-700">{errores.descuento}</p> : null}
          </div>
          <dl className="space-y-0.5 text-right text-sm">
            <div>
              <dt className="inline text-palacio-muted">Subtotal: </dt>
              <dd className="inline text-zinc-900">{monedaFmt.format(subtotal)}</dd>
            </div>
            <div>
              <dt className="inline text-palacio-muted">Descuento{pct ? ` (${pct}%)` : ""}: </dt>
              <dd className="inline text-zinc-900">{monedaFmt.format(descuentoTotal)}</dd>
            </div>
            <div>
              <dt className="inline text-palacio-muted">Total: </dt>
              <dd className="inline font-semibold text-zinc-900">{monedaFmt.format(total)}</dd>
            </div>
          </dl>
        </div>
      </div>

      {enCaja ? (
        <div className="palacio-card mt-6 overflow-hidden">
          <div className="border-b border-palacio-border px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Cobro en caja</h2>
          </div>

          <div className="space-y-3 p-4">
            {mediosPago.map((m, idx) => {
              const medio = medios.find((x) => x.id_medio_pago === m.id_medio_pago);
              const acredita = acreditarEnTesoreria(m.id_medio_pago);
              return (
                <div
                  key={m.key}
                  className="grid gap-3 rounded-lg border border-palacio-border p-3 md:grid-cols-[1fr_9rem_1fr_auto]"
                >
                  <div className="space-y-2">
                    <select
                      value={m.id_medio_pago}
                      onChange={(e) => elegirMedioCobro(idx, e.target.value)}
                      className="palacio-input"
                    >
                      <option value="">Medio de pago…</option>
                      {medios.map((mp) => (
                        <option key={mp.id_medio_pago} value={mp.id_medio_pago}>
                          {mp.nombre_medio_pago}
                          {mp.tipo === "Mercado Pago" ? " (simulado)" : ""}
                        </option>
                      ))}
                    </select>
                    {acredita && m.cargandoCuentas ? (
                      <p className="text-xs text-palacio-muted">Cargando cuentas…</p>
                    ) : null}
                    {acredita && !m.cargandoCuentas && m.cuentas.length === 1 ? (
                      <p className="text-xs text-palacio-muted">Se acredita en {m.cuentas[0].nombre_cuenta}</p>
                    ) : null}
                    {acredita && !m.cargandoCuentas && m.cuentas.length > 1 ? (
                      <select
                        value={m.id_cuenta_tesoreria}
                        onChange={(e) => setMedio(idx, { id_cuenta_tesoreria: e.target.value })}
                        className="palacio-input"
                      >
                        <option value="">Cuenta de tesorería…</option>
                        {m.cuentas.map((c) => (
                          <option key={c.id_cuenta} value={c.id_cuenta}>
                            {c.nombre_cuenta}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    {acredita && !m.cargandoCuentas && m.cuentas.length === 0 ? (
                      <p className="text-xs text-amber-700">
                        Ese medio no tiene una cuenta de tesorería activa. Asignala en Medios de pago.
                      </p>
                    ) : null}
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={m.importe}
                    onChange={(e) => setMedio(idx, { importe: e.target.value })}
                    className="palacio-input text-right"
                    placeholder="Importe"
                  />
                  <input
                    type="text"
                    value={m.referencia}
                    onChange={(e) => setMedio(idx, { referencia: e.target.value })}
                    maxLength={120}
                    className="palacio-input"
                    placeholder={medio?.requiere_referencia ? "Referencia (requerida)" : "Referencia"}
                  />
                  <button
                    type="button"
                    onClick={() => quitarMedio(idx)}
                    disabled={mediosPago.length === 1}
                    className="palacio-action-btn palacio-action-danger self-center"
                  >
                    Quitar
                  </button>
                </div>
              );
            })}
          </div>

          {errores.medios ? (
            <p className="mx-5 mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errores.medios}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-palacio-border px-5 py-3">
            <button type="button" onClick={agregarMedio} className="palacio-btn-secondary px-3 py-2 text-sm">
              Agregar medio
            </button>
            <div className="text-right text-sm">
              <p className="text-palacio-muted">
                Total medios: <span className="font-semibold text-zinc-900">{monedaFmt.format(totalMedios)}</span>
              </p>
              {diferenciaMedios !== 0 ? (
                <p className="text-amber-700">
                  {diferenciaMedios < 0
                    ? `Faltan ${monedaFmt.format(-diferenciaMedios)}`
                    : `Sobran ${monedaFmt.format(diferenciaMedios)}`}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {errorServer ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorServer}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={enviar}
          disabled={pending || !lista || (enCaja && (!caja || diferenciaMedios !== 0))}
          className="palacio-btn-primary px-4 py-2.5 text-sm"
        >
          {pending ? "Registrando…" : enCaja ? "Registrar y cobrar" : "Registrar venta"}
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
