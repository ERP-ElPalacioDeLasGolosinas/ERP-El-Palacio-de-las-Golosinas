"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { guardarCajaRegistradora } from "@/lib/cajas/v2-actions";
import { mapErrorCaja } from "@/lib/cajas/errores";

/**
 * Gerente: alta o edición de una caja física (número, nombre, depósito, activa).
 *
 * @param {{
 *   depositos: Array<{ id_deposito: string, nombre_deposito: string }>,
 *   caja?: { id_registradora: string, numero: number, nombre: string | null, id_deposito: string, activa: boolean } | null,
 *   sugerido?: number,
 *   onListo?: () => void,
 * }} props
 */
export function CajaRegistradoraForm({ depositos, caja = null, sugerido = 1, idDepositoFijo = null, onListo }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [numero, setNumero] = useState(String(caja?.numero ?? sugerido));
  const [nombre, setNombre] = useState(caja?.nombre ?? "");
  const [idDeposito, setIdDeposito] = useState(
    caja?.id_deposito ?? idDepositoFijo ?? (depositos.length === 1 ? depositos[0].id_deposito : "")
  );
  const depositoFijo = idDepositoFijo ? depositos.find((d) => d.id_deposito === idDepositoFijo) : null;
  const [activa, setActiva] = useState(caja?.activa ?? true);
  const [error, setError] = useState(null);

  function enviar(e) {
    e.preventDefault();
    setError(null);
    if (!(Number(numero) > 0)) return setError("El número de caja tiene que ser mayor a cero.");
    if (!idDeposito) return setError("Elegí el depósito del que vende la caja.");

    startTransition(async () => {
      const result = await guardarCajaRegistradora({
        id_registradora: caja?.id_registradora ?? null,
        numero,
        nombre,
        id_deposito: idDeposito,
        activa,
      });
      if (!result.ok) {
        setError(mapErrorCaja(result).message);
        return;
      }
      if (!caja) {
        setNumero(String(Number(numero) + 1));
        setNombre("");
      }
      router.refresh();
      onListo?.();
    });
  }

  return (
    <form onSubmit={enviar} className="space-y-3">
      <div className="grid grid-cols-[5rem_1fr] gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-800" htmlFor={`num-${caja?.id_registradora ?? "nueva"}`}>
            Número
          </label>
          <input
            id={`num-${caja?.id_registradora ?? "nueva"}`}
            type="number"
            min="1"
            step="1"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            className="palacio-input"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-800" htmlFor={`nom-${caja?.id_registradora ?? "nueva"}`}>
            Nombre (opcional)
          </label>
          <input
            id={`nom-${caja?.id_registradora ?? "nueva"}`}
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={60}
            className="palacio-input"
            placeholder="Ej.: Mostrador"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-zinc-800" htmlFor={`dep-${caja?.id_registradora ?? "nueva"}`}>
          Sucursal (depósito)
        </label>
        {depositoFijo ? (
          <p className="palacio-input bg-zinc-50 text-zinc-800">{depositoFijo.nombre_deposito}</p>
        ) : (
          <select
            id={`dep-${caja?.id_registradora ?? "nueva"}`}
            value={idDeposito}
            onChange={(e) => setIdDeposito(e.target.value)}
            className="palacio-input"
          >
            <option value="">Elegí una sucursal…</option>
            {depositos.map((d) => (
              <option key={d.id_deposito} value={d.id_deposito}>
                {d.nombre_deposito}
              </option>
            ))}
          </select>
        )}
      </div>
      {caja ? (
        <label className="flex items-center gap-2 text-sm text-zinc-800">
          <input type="checkbox" checked={activa} onChange={(e) => setActiva(e.target.checked)} />
          Activa
        </label>
      ) : null}

      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="palacio-btn-primary px-4 py-2 text-sm">
          {pending ? "Guardando…" : caja ? "Guardar" : "Crear caja"}
        </button>
        {caja && onListo ? (
          <button type="button" onClick={onListo} className="palacio-btn-secondary px-4 py-2 text-sm">
            Cancelar
          </button>
        ) : null}
      </div>
    </form>
  );
}
