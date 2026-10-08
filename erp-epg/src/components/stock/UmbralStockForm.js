"use client";

import { useState, useTransition } from "react";
import { guardarUmbral } from "@/lib/stock/actions";
import { mapErrorLote } from "@/lib/stock/errores";

const numFmt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 });

function texto(valor) {
  if (valor == null || valor === "") return "";
  const n = Number(valor);
  return Number.isFinite(n) ? String(n) : "";
}

/**
 * @param {{
 *   idProducto: string,
 *   filas: Array<{ id_deposito: string, nombre_deposito: string, cantidad: number | string, stock_minimo: number | string | null, stock_maximo: number | string | null }>,
 * }} props
 */
export function UmbralStockForm({ idProducto, filas }) {
  const [pendingId, setPendingId] = useState(null);
  const [isPending, startTransition] = useTransition();
  const [valores, setValores] = useState(() =>
    Object.fromEntries(
      filas.map((f) => [
        f.id_deposito,
        { minimo: texto(f.stock_minimo), maximo: texto(f.stock_maximo) },
      ])
    )
  );
  const [avisos, setAvisos] = useState({});

  function setCampo(idDeposito, campo, valor) {
    setValores((prev) => ({
      ...prev,
      [idDeposito]: { ...prev[idDeposito], [campo]: valor },
    }));
    setAvisos((prev) => ({ ...prev, [idDeposito]: null }));
  }

  function guardar(fila) {
    const actual = valores[fila.id_deposito] ?? { minimo: "", maximo: "" };
    const min = actual.minimo === "" ? null : Number(actual.minimo);
    const max = actual.maximo === "" ? null : Number(actual.maximo);

    if ((min != null && !(min >= 0)) || (max != null && !(max >= 0))) {
      setAvisos((prev) => ({
        ...prev,
        [fila.id_deposito]: { ok: false, message: "El mínimo y el máximo no pueden ser negativos." },
      }));
      return;
    }
    if (min != null && max != null && min > max) {
      setAvisos((prev) => ({
        ...prev,
        [fila.id_deposito]: { ok: false, message: "El mínimo no puede ser mayor que el máximo." },
      }));
      return;
    }

    setPendingId(fila.id_deposito);
    startTransition(async () => {
      const result = await guardarUmbral({
        id_producto: idProducto,
        id_deposito: fila.id_deposito,
        stock_minimo: actual.minimo,
        stock_maximo: actual.maximo,
      });
      setPendingId(null);
      if (!result.ok) {
        setAvisos((prev) => ({
          ...prev,
          [fila.id_deposito]: { ok: false, message: mapErrorLote(result).message },
        }));
        return;
      }
      setAvisos((prev) => ({
        ...prev,
        [fila.id_deposito]: {
          ok: true,
          message: min == null && max == null ? "Umbral quitado." : "Guardado.",
        },
      }));
    });
  }

  if (filas.length === 0) {
    return (
      <p className="text-sm text-palacio-muted">No hay depósitos activos.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-palacio-border">
            <th className="px-3 py-2 text-[11px] font-semibold tracking-wider text-palacio-muted uppercase">
              Depósito
            </th>
            <th className="px-3 py-2 text-[11px] font-semibold tracking-wider text-palacio-muted uppercase">
              Stock actual
            </th>
            <th className="px-3 py-2 text-[11px] font-semibold tracking-wider text-palacio-muted uppercase">
              Mínimo
            </th>
            <th className="px-3 py-2 text-[11px] font-semibold tracking-wider text-palacio-muted uppercase">
              Máximo
            </th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => {
            const actual = valores[fila.id_deposito] ?? { minimo: "", maximo: "" };
            const aviso = avisos[fila.id_deposito];
            return (
              <tr key={fila.id_deposito} className="border-b border-palacio-border last:border-0">
                <td className="px-3 py-2 font-medium text-zinc-900">{fila.nombre_deposito}</td>
                <td className="px-3 py-2 tabular-nums text-palacio-muted">
                  {numFmt.format(Number(fila.cantidad ?? 0))}
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={actual.minimo}
                    onChange={(e) => setCampo(fila.id_deposito, "minimo", e.target.value)}
                    className="palacio-input w-28"
                    placeholder="Sin mínimo"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={actual.maximo}
                    onChange={(e) => setCampo(fila.id_deposito, "maximo", e.target.value)}
                    className="palacio-input w-28"
                    placeholder="Sin máximo"
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="palacio-btn-secondary"
                      disabled={isPending && pendingId === fila.id_deposito}
                      onClick={() => guardar(fila)}
                    >
                      Guardar
                    </button>
                    {aviso ? (
                      <span className={aviso.ok ? "text-xs text-green-700" : "text-xs text-red-600"}>
                        {aviso.message}
                      </span>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
