"use client";

import { useActionState, useEffect, useRef } from "react";
import { crearTipoMovimiento } from "./actions";

const ESTADO_INICIAL = { error: null, success: false };

export default function NuevoTipoMovimientoForm() {
  const [state, formAction, pending] = useActionState(
    crearTipoMovimiento,
    ESTADO_INICIAL
  );
  const formRef = useRef(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/15"
    >
      <h2 className="text-lg font-semibold">Nuevo tipo de movimiento</h2>

      <div className="flex flex-col gap-1">
        <label htmlFor="nombre_tipo_movimiento" className="text-sm font-medium">
          Nombre
        </label>
        <input
          id="nombre_tipo_movimiento"
          name="nombre_tipo_movimiento"
          type="text"
          required
          maxLength={120}
          placeholder="Ej: Ingreso por compra"
          className="rounded border border-black/20 bg-transparent px-3 py-2 text-sm dark:border-white/20"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="descripcion_tipo_movimiento"
          className="text-sm font-medium"
        >
          Descripción
        </label>
        <textarea
          id="descripcion_tipo_movimiento"
          name="descripcion_tipo_movimiento"
          required
          rows={2}
          placeholder="Ej: Ingreso de mercadería proveniente de una compra"
          className="rounded border border-black/20 bg-transparent px-3 py-2 text-sm dark:border-white/20"
        />
      </div>

      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-medium">Signo</legend>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="signo_tipo_movimiento" value="1" required />
            Entrada (+)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="signo_tipo_movimiento" value="-1" required />
            Salida (-)
          </label>
        </div>
      </fieldset>

      {state.error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Guardando..." : "Crear tipo de movimiento"}
      </button>
    </form>
  );
}
