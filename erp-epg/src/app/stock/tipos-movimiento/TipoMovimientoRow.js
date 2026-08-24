"use client";

import { useState, useTransition } from "react";
import { cambiarActivoTipoMovimiento, editarTipoMovimiento } from "./actions";

export default function TipoMovimientoRow({ tipoMovimiento }) {
  const [editando, setEditando] = useState(false);
  const [error, setError] = useState(null);
  const [guardando, startGuardar] = useTransition();
  const [cambiandoActivo, startTransition] = useTransition();

  const esEntrada = tipoMovimiento.signo_tipo_movimiento === 1;

  function manejarSubmit(evento) {
    evento.preventDefault();
    const formData = new FormData(evento.currentTarget);

    startGuardar(async () => {
      const resultado = await editarTipoMovimiento(null, formData);
      if (resultado.error) {
        setError(resultado.error);
      } else {
        setError(null);
        setEditando(false);
      }
    });
  }

  if (editando) {
    return (
      <tr className="border-t border-linea bg-ambar-bg/40">
        <td colSpan={5} className="px-4 py-2.5">
          <form onSubmit={manejarSubmit} className="flex flex-col gap-2">
            <input
              type="hidden"
              name="id_tipo_movimiento"
              value={tipoMovimiento.id_tipo_movimiento}
            />
            <div className="flex flex-wrap gap-2">
              <input
                name="nombre_tipo_movimiento"
                type="text"
                required
                maxLength={120}
                defaultValue={tipoMovimiento.nombre_tipo_movimiento}
                className="min-w-[200px] flex-1 rounded-[9px] border-[1.5px] border-oro bg-panel px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ambar-bg"
              />
              <input
                name="descripcion_tipo_movimiento"
                type="text"
                required
                defaultValue={tipoMovimiento.descripcion_tipo_movimiento}
                className="min-w-[240px] flex-[2] rounded-[9px] border-[1.5px] border-oro bg-panel px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ambar-bg"
              />
              <span className="self-center text-xs text-tinta-suave">
                Signo {esEntrada ? "Entrada (+)" : "Salida (-)"} (no editable)
              </span>
            </div>

            {error ? (
              <p role="alert" className="text-sm font-medium text-rojo">
                {error}
              </p>
            ) : null}

            <div className="flex gap-2">
              <button type="submit" disabled={guardando} className="btn-primary">
                {guardando ? "Guardando..." : "Guardar"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setEditando(false);
                }}
                className="btn-ghost"
              >
                Cancelar
              </button>
            </div>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr
      className={`border-t border-linea hover:bg-crema/60 ${
        tipoMovimiento.activo ? "" : "opacity-60"
      }`}
    >
      <td className="px-4 py-3 text-sm font-medium text-tinta">
        {tipoMovimiento.nombre_tipo_movimiento}
      </td>
      <td className="px-4 py-3 text-[13px] text-tinta-suave">
        {tipoMovimiento.descripcion_tipo_movimiento}
      </td>
      <td className="px-4 py-3 text-sm text-tinta">
        {esEntrada ? "Entrada (+)" : "Salida (-)"}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${
            tipoMovimiento.activo
              ? "bg-verde-bg text-verde"
              : "bg-ambar-bg text-ambar"
          }`}
        >
          {tipoMovimiento.activo ? "Activo" : "Inactivo"}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="btn-ghost"
          >
            Editar
          </button>
          <button
            type="button"
            disabled={cambiandoActivo}
            onClick={() =>
              startTransition(() =>
                cambiarActivoTipoMovimiento(
                  tipoMovimiento.id_tipo_movimiento,
                  !tipoMovimiento.activo
                )
              )
            }
            className={`btn-ghost ${
              tipoMovimiento.activo ? "text-rojo-hondo" : "text-verde"
            }`}
          >
            {tipoMovimiento.activo ? "Dar de baja" : "Reactivar"}
          </button>
        </div>
      </td>
    </tr>
  );
}
