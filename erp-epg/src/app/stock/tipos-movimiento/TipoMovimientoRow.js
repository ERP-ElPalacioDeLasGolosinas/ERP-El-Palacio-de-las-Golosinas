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
      <tr className="border-b border-black/10 dark:border-white/10">
        <td colSpan={5} className="p-3">
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
                className="min-w-[200px] flex-1 rounded border border-black/20 bg-transparent px-2 py-1 text-sm dark:border-white/20"
              />
              <input
                name="descripcion_tipo_movimiento"
                type="text"
                required
                defaultValue={tipoMovimiento.descripcion_tipo_movimiento}
                className="min-w-[240px] flex-[2] rounded border border-black/20 bg-transparent px-2 py-1 text-sm dark:border-white/20"
              />
              <span className="self-center text-xs text-black/60 dark:text-white/60">
                Signo {esEntrada ? "Entrada (+)" : "Salida (-)"} (no editable)
              </span>
            </div>

            {error ? (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            ) : null}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={guardando}
                className="rounded bg-black px-3 py-1 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
              >
                {guardando ? "Guardando..." : "Guardar"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setEditando(false);
                }}
                className="rounded border border-black/20 px-3 py-1 text-sm dark:border-white/20"
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
    <tr className="border-b border-black/10 dark:border-white/10">
      <td className="p-3 align-top">{tipoMovimiento.nombre_tipo_movimiento}</td>
      <td className="p-3 align-top">
        {tipoMovimiento.descripcion_tipo_movimiento}
      </td>
      <td className="p-3 align-top">
        {esEntrada ? "Entrada (+)" : "Salida (-)"}
      </td>
      <td className="p-3 align-top">
        {tipoMovimiento.activo ? "Activo" : "Inactivo"}
      </td>
      <td className="p-3 align-top">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="rounded border border-black/20 px-3 py-1 text-sm dark:border-white/20"
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
            className="rounded border border-black/20 px-3 py-1 text-sm disabled:opacity-50 dark:border-white/20"
          >
            {tipoMovimiento.activo ? "Dar de baja" : "Reactivar"}
          </button>
        </div>
      </td>
    </tr>
  );
}
