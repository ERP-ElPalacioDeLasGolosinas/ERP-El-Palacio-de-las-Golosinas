"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registrarMovimientoCaja } from "@/lib/cajas/actions";
import { mapErrorCaja } from "@/lib/cajas/errores";
import { moneda, saldoDisponible } from "@/components/cajas/formato";

const VACIO = { tipo: "Egreso", id_medio_pago: "", importe: "", motivo: "", referencia: "" };

/**
 * V-15 · Ingreso o egreso manual (retiro de efectivo, pago a un proveedor
 * menor, cambio, etc.). Un egreso no puede superar el saldo del medio.
 *
 * @param {{
 *   idCaja: string,
 *   resumen: Record<string, any>,
 *   medios: Array<{ id_medio_pago: string, nombre_medio_pago: string, tipo: string, requiere_referencia: boolean }>,
 * }} props
 */
export function MovimientoCajaForm({ idCaja, resumen, medios }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(() => ({
    ...VACIO,
    id_medio_pago: medios.find((m) => m.tipo === "Efectivo")?.id_medio_pago ?? "",
  }));
  const [errores, setErrores] = useState({});
  const [errorServer, setErrorServer] = useState(null);
  const [ok, setOk] = useState(null);

  const medio = medios.find((m) => m.id_medio_pago === form.id_medio_pago) ?? null;
  const disponible = saldoDisponible(resumen, medio);
  const excede = form.tipo === "Egreso" && medio && Number(form.importe) > disponible;

  function set(campo, valor) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
    setErrores({});
    setErrorServer(null);
    setOk(null);
  }

  function validar() {
    const next = {};
    if (!form.id_medio_pago) next.medio = "Elegí el medio.";
    if (!(Number(form.importe) > 0)) next.importe = "El importe tiene que ser mayor a cero.";
    else if (excede) next.importe = `El egreso supera el saldo disponible (${moneda(disponible)}).`;
    if (!form.motivo.trim()) next.motivo = "Indicá el motivo.";
    if (medio?.requiere_referencia && !form.referencia.trim()) next.medio = "Ese medio requiere una referencia.";
    setErrores(next);
    return Object.keys(next).length === 0;
  }

  function enviar(e) {
    e.preventDefault();
    if (!validar()) return;

    startTransition(async () => {
      const result = await registrarMovimientoCaja({ id_caja: idCaja, ...form });
      if (!result.ok) {
        const ui = mapErrorCaja(result);
        if (ui.field === "importe" || ui.field === "medio") setErrores({ [ui.field]: ui.message });
        else setErrorServer(ui.message);
        if (ui.reload) router.refresh();
        return;
      }
      setOk(`${form.tipo} de ${moneda(form.importe)} registrado.`);
      setForm((prev) => ({ ...VACIO, tipo: prev.tipo, id_medio_pago: prev.id_medio_pago }));
      router.refresh();
    });
  }

  return (
    <form onSubmit={enviar} className="palacio-card p-5">
      <h2 className="text-sm font-semibold text-zinc-900">Ingreso / egreso manual</h2>

      <div className="mt-3 inline-flex rounded-lg border border-palacio-border p-0.5 text-sm">
        {["Egreso", "Ingreso"].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => set("tipo", t)}
            className={`rounded-md px-3 py-1.5 font-medium ${
              form.tipo === t ? "bg-zinc-900 text-white" : "text-palacio-muted hover:text-zinc-900"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-palacio-muted">Medio</label>
          <select value={form.id_medio_pago} onChange={(e) => set("id_medio_pago", e.target.value)} className="palacio-input">
            <option value="">Medio…</option>
            {medios.map((m) => (
              <option key={m.id_medio_pago} value={m.id_medio_pago}>
                {m.nombre_medio_pago}
              </option>
            ))}
          </select>
          {medio && form.tipo === "Egreso" ? (
            <p className="text-xs text-palacio-muted">Disponible: {moneda(disponible)}</p>
          ) : null}
          {errores.medio ? <p className="text-xs text-red-700">{errores.medio}</p> : null}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-palacio-muted">Importe</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.importe}
            onChange={(e) => set("importe", e.target.value)}
            className="palacio-input text-right"
          />
          {errores.importe ? (
            <p className="text-xs text-red-700">{errores.importe}</p>
          ) : excede ? (
            <p className="text-xs text-amber-700">Supera el saldo disponible del medio.</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="text-xs font-medium text-palacio-muted">Motivo</label>
          <input
            type="text"
            value={form.motivo}
            onChange={(e) => set("motivo", e.target.value)}
            maxLength={200}
            className="palacio-input"
            placeholder={form.tipo === "Egreso" ? "Ej.: pago de flete, retiro de efectivo" : "Ej.: refuerzo de cambio"}
          />
          {errores.motivo ? <p className="text-xs text-red-700">{errores.motivo}</p> : null}
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="text-xs font-medium text-palacio-muted">
            Referencia{medio?.requiere_referencia ? " (requerida)" : ""}
          </label>
          <input
            type="text"
            value={form.referencia}
            onChange={(e) => set("referencia", e.target.value)}
            maxLength={120}
            className="palacio-input"
          />
        </div>
      </div>

      {errorServer ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorServer}</p>
      ) : null}
      {ok ? <p className="mt-3 text-sm text-emerald-700">{ok}</p> : null}

      <button type="submit" disabled={pending} className="palacio-btn-primary mt-4 px-4 py-2 text-sm">
        {pending ? "Registrando…" : `Registrar ${form.tipo.toLowerCase()}`}
      </button>
    </form>
  );
}
