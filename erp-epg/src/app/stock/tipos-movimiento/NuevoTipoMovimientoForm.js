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
      className="card flex flex-col gap-3 p-4"
    >
      <h2 className="font-baloo text-lg font-bold text-tinta">
        Nuevo tipo de movimiento
      </h2>

      <div className="flex flex-col gap-1">
        <label htmlFor="nombre_tipo_movimiento" className="text-sm font-medium text-tinta">
          Nombre
        </label>
        <input
          id="nombre_tipo_movimiento"
          name="nombre_tipo_movimiento"
          type="text"
          required
          maxLength={120}
          placeholder="Ej: Ingreso por compra"
          className="rounded-[9px] border-[1.5px] border-linea bg-panel px-3 py-2 text-sm outline-none placeholder:text-tinta-suave/60 focus:border-oro focus:ring-2 focus:ring-ambar-bg"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="descripcion_tipo_movimiento"
          className="text-sm font-medium text-tinta"
        >
          Descripción
        </label>
        <textarea
          id="descripcion_tipo_movimiento"
          name="descripcion_tipo_movimiento"
          required
          rows={2}
          placeholder="Ej: Ingreso de mercadería proveniente de una compra"
          className="rounded-[9px] border-[1.5px] border-linea bg-panel px-3 py-2 text-sm outline-none placeholder:text-tinta-suave/60 focus:border-oro focus:ring-2 focus:ring-ambar-bg"
        />
      </div>

      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-medium text-tinta">Signo</legend>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm text-tinta">
            <input type="radio" name="signo_tipo_movimiento" value="1" required />
            Entrada (+)
          </label>
          <label className="flex items-center gap-2 text-sm text-tinta">
            <input type="radio" name="signo_tipo_movimiento" value="-1" required />
            Salida (-)
          </label>
        </div>
      </fieldset>

      {state.error ? (
        <p role="alert" className="text-sm font-medium text-rojo">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="btn-primary self-start">
        {pending ? "Guardando..." : "Crear tipo de movimiento"}
      </button>
    </form>
  );
}
