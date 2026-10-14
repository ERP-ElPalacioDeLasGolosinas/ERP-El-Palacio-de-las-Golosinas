"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { levantarCaja } from "@/lib/cajas/v2-actions";
import { mapErrorCaja } from "@/lib/cajas/errores";

/**
 * El gerente levanta una caja desocupada para un `Empleado Ventas`, cargando el monto inicial.
 * La sesión nace autorizada: el empleado ya puede vender sin pedir apertura.
 * Pensado para abrirse dentro de la tarjeta de la caja.
 *
 * @param {{
 *   idRegistradora: string,
 *   empleados: Array<{ id_usuario: string, nombre_completo: string }>,
 *   onListo?: () => void,
 *   onCancelar?: () => void,
 * }} props
 */
export function LevantarCajaForm({ idRegistradora, empleados, onListo, onCancelar }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [idEmpleado, setIdEmpleado] = useState("");
  const [monto, setMonto] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [errores, setErrores] = useState({});
  const [errorServer, setErrorServer] = useState(null);

  function enviar(e) {
    e.preventDefault();
    setErrorServer(null);
    const next = {};
    if (!idEmpleado) next.empleado = "Elegí el empleado que va a operar la caja.";
    if (monto === "" || !(Number(monto) >= 0)) next.monto = "Ingresá el monto inicial (puede ser cero).";
    setErrores(next);
    if (Object.keys(next).length > 0) return;

    startTransition(async () => {
      const result = await levantarCaja({
        id_registradora: idRegistradora,
        id_empleado: idEmpleado,
        monto_inicial: monto,
        observaciones,
      });
      if (!result.ok) {
        const ui = mapErrorCaja(result);
        setErrorServer(ui.message);
        if (ui.reload) router.refresh();
        return;
      }
      router.refresh();
      onListo?.();
    });
  }

  if (empleados.length === 0) {
    return (
      <div className="space-y-3 text-sm">
        <p className="text-palacio-muted">No hay empleados de ventas disponibles: todos tienen una caja asignada.</p>
        {onCancelar ? (
          <button type="button" onClick={onCancelar} className="palacio-btn-secondary px-3 py-2 text-sm">
            Cerrar
          </button>
        ) : null}
      </div>
    );
  }

  const sufijo = idRegistradora;

  return (
    <form onSubmit={enviar} className="space-y-3 text-sm">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`lev-empleado-${sufijo}`} className="font-medium text-zinc-800">
          Empleado <span className="text-palacio-red">*</span>
        </label>
        <select
          id={`lev-empleado-${sufijo}`}
          value={idEmpleado}
          onChange={(e) => {
            setIdEmpleado(e.target.value);
            setErrores({});
          }}
          className="palacio-input"
        >
          <option value="">Elegí un empleado</option>
          {empleados.map((emp) => (
            <option key={emp.id_usuario} value={emp.id_usuario}>
              {emp.nombre_completo}
            </option>
          ))}
        </select>
        {errores.empleado ? <p className="text-xs text-red-700">{errores.empleado}</p> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`lev-monto-${sufijo}`} className="font-medium text-zinc-800">
          Monto inicial en efectivo <span className="text-palacio-red">*</span>
        </label>
        <input
          id={`lev-monto-${sufijo}`}
          type="number"
          min="0"
          step="0.01"
          value={monto}
          onChange={(e) => {
            setMonto(e.target.value);
            setErrores({});
          }}
          className="palacio-input text-right"
          placeholder="0,00"
        />
        {errores.monto ? <p className="text-xs text-red-700">{errores.monto}</p> : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`lev-obs-${sufijo}`} className="font-medium text-zinc-800">
          Observaciones
        </label>
        <input
          id={`lev-obs-${sufijo}`}
          type="text"
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          maxLength={300}
          className="palacio-input"
        />
      </div>

      {errorServer ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">{errorServer}</p>
      ) : null}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="palacio-btn-primary px-3 py-2 text-sm">
          {pending ? "Levantando…" : "Levantar caja"}
        </button>
        {onCancelar ? (
          <button type="button" onClick={onCancelar} disabled={pending} className="palacio-btn-secondary px-3 py-2 text-sm">
            Cancelar
          </button>
        ) : null}
      </div>
    </form>
  );
}
