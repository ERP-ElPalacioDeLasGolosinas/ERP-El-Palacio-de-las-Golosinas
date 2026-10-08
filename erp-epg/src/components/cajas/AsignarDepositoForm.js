"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { asignarDepositoCaja } from "@/lib/cajas/actions";
import { mapErrorCaja } from "@/lib/cajas/errores";

/**
 * Para la caja que se abrió antes de pedir el depósito. Se asigna una sola vez
 * y a partir de ahí la venta de esa caja sale solo de ese depósito.
 *
 * @param {{
 *   idCaja: string,
 *   depositos: Array<{ id_deposito: string, nombre_deposito: string }>,
 * }} props
 */
export function AsignarDepositoForm({ idCaja, depositos }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [idDeposito, setIdDeposito] = useState(depositos.length === 1 ? depositos[0].id_deposito : "");
  const [error, setError] = useState(null);

  function enviar(e) {
    e.preventDefault();
    if (!idDeposito) {
      setError("Elegí el depósito de la sucursal.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await asignarDepositoCaja({ id_caja: idCaja, id_deposito: idDeposito });
      if (!result.ok) {
        setError(mapErrorCaja(result).message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={enviar} className="palacio-card mb-6 border-amber-200 bg-amber-50 p-5">
      <h2 className="text-sm font-semibold text-amber-950">Esta caja no tiene depósito</h2>
      <p className="mt-1 text-sm text-amber-900/80">
        Se abrió antes de pedirlo. Elegí la sucursal: después no se puede cambiar, y las ventas de esta caja van a salir
        solo de ese stock.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex min-w-56 flex-col gap-1 text-xs font-medium text-amber-950">
          Depósito
          <select
            value={idDeposito}
            onChange={(e) => {
              setIdDeposito(e.target.value);
              setError(null);
            }}
            className="palacio-input"
          >
            <option value="">Elegí un depósito…</option>
            {depositos.map((d) => (
              <option key={d.id_deposito} value={d.id_deposito}>
                {d.nombre_deposito}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={pending} className="palacio-btn-primary px-4 py-2 text-sm">
          {pending ? "Asignando…" : "Asignar depósito"}
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </form>
  );
}
