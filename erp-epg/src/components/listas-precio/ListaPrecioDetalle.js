"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  actualizarListaPrecio,
  guardarPreciosLista,
  quitarPrecioLista,
} from "@/lib/listas-precio/actions";
import { mapErrorListaPrecio } from "@/lib/listas-precio/errores";
import {
  BADGE_POR_VENCER,
  badgeEstadoLista,
  formatFechaLista,
} from "@/lib/listas-precio/constantes";

const monedaFmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

/**
 * A-11 · Detalle de una lista: cabecera editable y grilla de precios.
 * Si la lista está vencida, todo es de solo lectura. El padre debe pasar un
 * `key` que cambie cuando cambian los datos (p. ej. `lista.editado`).
 *
 * @param {{
 *   lista: Record<string, any>,
 *   productos: Array<{ id_producto: string, codigo_producto?: string, nombre_producto: string }>,
 * }} props
 */
export function ListaPrecioDetalle({ lista, productos }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const soloLectura = lista.estado_vigencia === "Vencida";
  const inicioEditable = lista.estado_vigencia === "Futura";

  const [nombre, setNombre] = useState(lista.nombre_lista_precio);
  const [fechaInicio, setFechaInicio] = useState(String(lista.fecha_inicio).slice(0, 10));
  const [fechaFin, setFechaFin] = useState(lista.fecha_fin ? String(lista.fecha_fin).slice(0, 10) : "");
  const [observaciones, setObservaciones] = useState(lista.observaciones ?? "");
  const [errorNombre, setErrorNombre] = useState(null);
  const [errorFechas, setErrorFechas] = useState(null);
  const [errorCabecera, setErrorCabecera] = useState(null);
  const [okCabecera, setOkCabecera] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const [ediciones, setEdiciones] = useState({});
  const [errorPrecios, setErrorPrecios] = useState(null);
  const [okPrecios, setOkPrecios] = useState(false);
  const [nuevoProducto, setNuevoProducto] = useState("");
  const [nuevoPrecio, setNuevoPrecio] = useState("");

  const precios = useMemo(() => lista.precios ?? [], [lista.precios]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return precios;
    return precios.filter(
      (p) =>
        p.nombre_producto.toLowerCase().includes(q) ||
        (p.codigo_producto ?? "").toLowerCase().includes(q)
    );
  }, [precios, busqueda]);

  const disponibles = useMemo(() => {
    const enLista = new Set(precios.map((p) => p.id_producto));
    return productos.filter((p) => !enLista.has(p.id_producto));
  }, [productos, precios]);

  const modificados = precios.filter(
    (p) => ediciones[p.id_producto] !== undefined && Number(ediciones[p.id_producto]) !== Number(p.precio)
  );

  function manejarError(result, setter) {
    const ui = mapErrorListaPrecio(result);
    setter(ui.message);
    if (ui.reload) router.refresh();
    return ui;
  }

  function guardarCabecera(e) {
    e.preventDefault();
    setErrorNombre(null);
    setErrorFechas(null);
    setErrorCabecera(null);
    setOkCabecera(false);

    if (!nombre.trim()) {
      setErrorNombre("El nombre es obligatorio.");
      return;
    }
    if (!fechaInicio) {
      setErrorFechas("La fecha de inicio es obligatoria.");
      return;
    }
    if (fechaFin && fechaFin < fechaInicio) {
      setErrorFechas("La fecha de fin no puede ser anterior a la de inicio.");
      return;
    }

    startTransition(async () => {
      const result = await actualizarListaPrecio(lista.id_lista_precio, {
        nombre: nombre.trim(),
        fechaInicio,
        fechaFin: fechaFin || null,
        observaciones: observaciones.trim() || null,
      });
      if (!result.ok) {
        const ui = mapErrorListaPrecio(result);
        if (ui.field === "nombre") setErrorNombre(ui.message);
        else if (ui.field === "fechas") setErrorFechas(ui.message);
        else setErrorCabecera(ui.message);
        if (ui.reload) router.refresh();
        return;
      }
      setOkCabecera(true);
      router.refresh();
    });
  }

  function guardarCambios() {
    setErrorPrecios(null);
    setOkPrecios(false);
    for (const p of modificados) {
      const v = ediciones[p.id_producto];
      if (v === "" || Number.isNaN(Number(v)) || Number(v) < 0) {
        setErrorPrecios(`El precio de "${p.nombre_producto}" debe ser un número mayor o igual a 0.`);
        return;
      }
    }
    startTransition(async () => {
      const result = await guardarPreciosLista(
        lista.id_lista_precio,
        modificados.map((p) => ({ id_producto: p.id_producto, precio: ediciones[p.id_producto] }))
      );
      if (!result.ok) {
        manejarError(result, setErrorPrecios);
        return;
      }
      setEdiciones({});
      setOkPrecios(true);
      router.refresh();
    });
  }

  function agregarArticulo() {
    setErrorPrecios(null);
    setOkPrecios(false);
    if (!nuevoProducto) {
      setErrorPrecios("Elegí el artículo a agregar.");
      return;
    }
    if (nuevoPrecio === "" || Number(nuevoPrecio) < 0) {
      setErrorPrecios("Ingresá un precio mayor o igual a 0.");
      return;
    }
    startTransition(async () => {
      const result = await guardarPreciosLista(lista.id_lista_precio, [
        { id_producto: nuevoProducto, precio: nuevoPrecio },
      ]);
      if (!result.ok) {
        manejarError(result, setErrorPrecios);
        return;
      }
      setNuevoProducto("");
      setNuevoPrecio("");
      router.refresh();
    });
  }

  function quitar(p) {
    if (!window.confirm(`¿Quitar "${p.nombre_producto}" de la lista? Dejará de poder venderse con esta lista.`)) {
      return;
    }
    setErrorPrecios(null);
    setOkPrecios(false);
    startTransition(async () => {
      const result = await quitarPrecioLista(lista.id_lista_precio, p.id_producto);
      if (!result.ok) {
        manejarError(result, setErrorPrecios);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {soloLectura ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-950">
          Esta lista está vencida y es de solo lectura. Para actualizar precios creá una lista nueva
          copiando de esta.
        </div>
      ) : null}

      <form onSubmit={guardarCabecera} className="palacio-card flex flex-col gap-4 p-5 md:p-6" noValidate>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-900">Datos de la lista</h2>
          <div className="flex items-center gap-1.5">
            <span className={badgeEstadoLista(lista.estado_vigencia)}>{lista.estado_vigencia}</span>
            {lista.por_vencer ? <span className={BADGE_POR_VENCER}>Por vencer</span> : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Campo id="ld-nombre" label="Nombre" error={errorNombre}>
            <input
              id="ld-nombre"
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              disabled={soloLectura}
              className="palacio-input"
              maxLength={120}
            />
          </Campo>
          <Campo id="ld-tipo" label="Tipo de lista">
            <input id="ld-tipo" type="text" value={lista.tipo_lista} disabled className="palacio-input" />
          </Campo>
          <Campo id="ld-inicio" label="Vigente desde" error={errorFechas}>
            <input
              id="ld-inicio"
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              disabled={!inicioEditable}
              className="palacio-input"
            />
            {!soloLectura && !inicioEditable ? (
              <p className="text-xs text-palacio-muted">El inicio solo se puede cambiar en listas futuras.</p>
            ) : null}
          </Campo>
          <Campo id="ld-fin" label="Vigente hasta">
            <input
              id="ld-fin"
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              disabled={soloLectura}
              className="palacio-input"
            />
          </Campo>
        </div>

        <Campo id="ld-obs" label="Observaciones">
          <textarea
            id="ld-obs"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            disabled={soloLectura}
            className="palacio-input"
            rows={2}
          />
        </Campo>

        <p className="text-xs text-palacio-muted">
          Creada por {lista.creado_por_nombre ?? "—"} · vigencia {formatFechaLista(lista.fecha_inicio)} →{" "}
          {lista.fecha_fin ? formatFechaLista(lista.fecha_fin) : "sin fin"}
        </p>

        {errorCabecera ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorCabecera}
          </p>
        ) : null}
        {okCabecera ? <p className="text-sm text-emerald-700">Cambios guardados.</p> : null}

        {soloLectura ? null : (
          <div>
            <button type="submit" disabled={pending} className="palacio-btn-primary px-4 py-2.5 text-sm">
              {pending ? "Guardando…" : "Guardar datos"}
            </button>
          </div>
        )}
      </form>

      <div className="palacio-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-palacio-border px-5 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-semibold text-zinc-900">Precios</h2>
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar artículo o código"
              className="palacio-input max-w-xs"
            />
          </div>
          <span className="text-xs text-palacio-muted">
            {precios.length} artículo{precios.length === 1 ? "" : "s"}
          </span>
        </div>

        {soloLectura ? null : (
          <div className="flex flex-wrap items-end gap-3 border-b border-palacio-border bg-zinc-50/80 px-5 py-3">
            <label className="flex min-w-60 flex-1 flex-col gap-1 text-xs font-medium text-palacio-muted">
              Agregar artículo
              <select
                value={nuevoProducto}
                onChange={(e) => setNuevoProducto(e.target.value)}
                className="palacio-input"
              >
                <option value="">
                  {disponibles.length === 0 ? "Todos los artículos ya están en la lista" : "Elegí un artículo…"}
                </option>
                {disponibles.map((p) => (
                  <option key={p.id_producto} value={p.id_producto}>
                    {p.codigo_producto ? `${p.codigo_producto} · ` : ""}
                    {p.nombre_producto}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-palacio-muted">
              Precio
              <input
                type="number"
                min="0"
                step="0.01"
                value={nuevoPrecio}
                onChange={(e) => setNuevoPrecio(e.target.value)}
                className="palacio-input w-32"
              />
            </label>
            <button
              type="button"
              onClick={agregarArticulo}
              disabled={pending}
              className="palacio-btn-secondary px-4 py-2.5 text-sm"
            >
              Agregar
            </button>
          </div>
        )}

        {precios.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-palacio-muted">
            La lista todavía no tiene precios. Los artículos sin precio no se pueden vender con ella.
          </p>
        ) : filtrados.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-palacio-muted">
            Ningún artículo coincide con la búsqueda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-palacio-border bg-zinc-50/80">
                  <Th>Código</Th>
                  <Th>Artículo</Th>
                  <Th className="text-right">Precio</Th>
                  {soloLectura ? null : <Th className="text-right">Acciones</Th>}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => {
                  const valor = ediciones[p.id_producto] ?? String(p.precio);
                  const cambiado = ediciones[p.id_producto] !== undefined && Number(valor) !== Number(p.precio);
                  return (
                    <tr key={p.id_producto} className="border-b border-palacio-border last:border-0">
                      <td className="px-5 py-3 align-middle font-mono text-xs text-palacio-muted">
                        {p.codigo_producto ?? "—"}
                      </td>
                      <td className="px-5 py-3 align-middle font-medium text-zinc-900">
                        {p.nombre_producto}
                        {p.activo === false ? (
                          <span className="ml-2 text-xs font-normal text-palacio-muted">(inactivo)</span>
                        ) : null}
                      </td>
                      <td className="px-5 py-3 text-right align-middle">
                        {soloLectura ? (
                          monedaFmt.format(Number(p.precio) || 0)
                        ) : (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={valor}
                            onChange={(e) =>
                              setEdiciones((prev) => ({ ...prev, [p.id_producto]: e.target.value }))
                            }
                            aria-label={`Precio de ${p.nombre_producto}`}
                            className={`palacio-input ml-auto w-32 text-right ${cambiado ? "border-amber-400" : ""}`}
                          />
                        )}
                      </td>
                      {soloLectura ? null : (
                        <td className="px-5 py-3 align-middle">
                          <div className="flex justify-end">
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => quitar(p)}
                              className="palacio-action-btn"
                            >
                              Quitar
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {errorPrecios ? (
          <p className="mx-5 my-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorPrecios}
          </p>
        ) : null}
        {okPrecios ? <p className="px-5 py-3 text-sm text-emerald-700">Precios guardados.</p> : null}

        {soloLectura ? null : (
          <div className="flex flex-wrap items-center gap-3 border-t border-palacio-border px-5 py-3">
            <button
              type="button"
              onClick={guardarCambios}
              disabled={pending || modificados.length === 0}
              className="palacio-btn-primary px-4 py-2.5 text-sm"
            >
              {pending ? "Guardando…" : `Guardar precios${modificados.length ? ` (${modificados.length})` : ""}`}
            </button>
            {modificados.length > 0 ? (
              <button type="button" onClick={() => setEdiciones({})} className="palacio-action-btn">
                Descartar cambios
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function Campo({ id, label, error = null, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-zinc-800">
        {label}
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
