"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { crearListaPrecio } from "@/lib/listas-precio/actions";
import { mapErrorListaPrecio } from "@/lib/listas-precio/errores";
import { TIPOS_LISTA, hoyISO } from "@/lib/listas-precio/constantes";

/**
 * A-11 · Alta de lista de precios, con opción de copiar los precios de otra lista
 * aplicando un ajuste porcentual.
 *
 * @param {{
 *   listasOrigen: Array<{ id_lista_precio: string, nombre_lista_precio: string,
 *     tipo_lista: string, estado_vigencia: string, cantidad_articulos: number }>,
 * }} props
 */
export function ListaPrecioForm({ listasOrigen }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState("");
  const [fechaInicio, setFechaInicio] = useState(() => hoyISO());
  const [fechaFin, setFechaFin] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [idOrigen, setIdOrigen] = useState("");
  const [ajuste, setAjuste] = useState("0");
  const [errores, setErrores] = useState({});
  const [errorServer, setErrorServer] = useState(null);

  function onSubmit(e) {
    e.preventDefault();
    setErrorServer(null);

    const nuevos = {};
    if (!nombre.trim()) nuevos.nombre = "El nombre es obligatorio.";
    if (!TIPOS_LISTA.includes(tipo)) nuevos.tipo = "Elegí el tipo de lista.";
    if (!fechaInicio) nuevos.fechas = "La fecha de inicio es obligatoria.";
    else if (fechaFin && fechaFin < fechaInicio)
      nuevos.fechas = "La fecha de fin no puede ser anterior a la de inicio.";
    else if (fechaFin && fechaFin < hoyISO())
      nuevos.fechas = "No se puede crear una lista que ya está vencida.";
    if (idOrigen && (ajuste === "" || Number(ajuste) < -100))
      nuevos.ajuste = "El ajuste debe ser un número mayor o igual a -100.";
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;

    startTransition(async () => {
      const result = await crearListaPrecio({
        nombre: nombre.trim(),
        tipo,
        fechaInicio,
        fechaFin: fechaFin || null,
        observaciones: observaciones.trim() || null,
        idListaOrigen: idOrigen || null,
        ajuste: Number(ajuste),
      });

      if (!result.ok) {
        const ui = mapErrorListaPrecio(result);
        if (ui.field === "nombre") setErrores({ nombre: ui.message });
        else if (ui.field === "fechas") setErrores({ fechas: ui.message });
        else setErrorServer(ui.message);
        return;
      }

      router.push(
        result.id ? `/ventas/listas-de-precios/${result.id}` : "/ventas/listas-de-precios"
      );
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="palacio-card flex flex-col gap-5 p-5 md:p-6" noValidate>
      <div className="grid gap-4 md:grid-cols-2">
        <Campo id="lp-nombre" label="Nombre" requerido error={errores.nombre}>
          <input
            id="lp-nombre"
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="palacio-input"
            placeholder="Ej. Mayorista noviembre"
            maxLength={120}
          />
        </Campo>
        <Campo id="lp-tipo" label="Tipo de lista" requerido error={errores.tipo}>
          <select
            id="lp-tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="palacio-input"
          >
            <option value="">Elegí un tipo…</option>
            {TIPOS_LISTA.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id="lp-inicio" label="Vigente desde" requerido error={errores.fechas}>
          <input
            id="lp-inicio"
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            className="palacio-input"
          />
        </Campo>
        <Campo id="lp-fin" label="Vigente hasta (opcional)">
          <input
            id="lp-fin"
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            className="palacio-input"
          />
          <p className="text-xs text-palacio-muted">
            Sin fecha de fin la lista queda abierta y bloquea a cualquier posterior del mismo tipo.
          </p>
        </Campo>
      </div>

      <Campo id="lp-obs" label="Observaciones">
        <textarea
          id="lp-obs"
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          className="palacio-input"
          rows={2}
        />
      </Campo>

      <div className="rounded-lg border border-palacio-border bg-zinc-50 p-4">
        <p className="mb-3 text-sm font-medium text-zinc-800">Copiar precios de otra lista (opcional)</p>
        <div className="grid gap-4 md:grid-cols-2">
          <Campo id="lp-origen" label="Lista de origen">
            <select
              id="lp-origen"
              value={idOrigen}
              onChange={(e) => setIdOrigen(e.target.value)}
              className="palacio-input"
            >
              <option value="">No copiar (lista vacía)</option>
              {listasOrigen.map((l) => (
                <option key={l.id_lista_precio} value={l.id_lista_precio}>
                  {l.nombre_lista_precio} · {l.tipo_lista} · {l.estado_vigencia} ·{" "}
                  {l.cantidad_articulos} art.
                </option>
              ))}
            </select>
          </Campo>
          <Campo id="lp-ajuste" label="Ajuste %" error={errores.ajuste}>
            <input
              id="lp-ajuste"
              type="number"
              step="0.01"
              min="-100"
              value={ajuste}
              onChange={(e) => setAjuste(e.target.value)}
              disabled={!idOrigen}
              className="palacio-input"
            />
            <p className="text-xs text-palacio-muted">
              Ej. 10 sube todos los precios 10 %; -5 los baja 5 %. Se redondea a 2 decimales.
            </p>
          </Campo>
        </div>
      </div>

      {errorServer ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorServer}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 border-t border-palacio-border pt-4">
        <button type="submit" disabled={pending} className="palacio-btn-primary px-4 py-2.5 text-sm">
          {pending ? "Creando…" : "Crear lista de precios"}
        </button>
        <Link href="/ventas/listas-de-precios" className="palacio-btn-secondary inline-flex px-4 py-2.5 text-sm">
          Cancelar
        </Link>
      </div>
    </form>
  );
}

function Campo({ id, label, requerido = false, error = null, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-zinc-800">
        {label} {requerido ? <span className="text-palacio-red">*</span> : null}
      </label>
      {children}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
