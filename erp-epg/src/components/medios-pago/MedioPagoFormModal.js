"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  actualizarMedioPago,
  crearMedioPago,
} from "@/lib/medios-pago/actions";
import { mapErrorMedioPago } from "@/lib/medios-pago/errores";
import { TIPOS_MEDIO_PAGO } from "@/lib/medios-pago/constantes";

/**
 * Modal de alta / edición de medio de pago.
 *
 * @param {{
 *   onClose: () => void,
 *   medioPago?: {
 *     id_medio_pago: string,
 *     nombre_medio_pago: string,
 *     tipo?: string,
 *     requiere_referencia: boolean,
 *     cuentas?: Array<{ id_cuenta: string }>,
 *   } | null,
 *   cuentasDisponibles?: Array<{
 *     id_cuenta: string,
 *     nombre_cuenta: string,
 *     tipo: string,
 *   }>,
 * }} props
 */
export function MedioPagoFormModal({
  onClose,
  medioPago = null,
  cuentasDisponibles = [],
}) {
  const router = useRouter();
  const isEdit = Boolean(medioPago?.id_medio_pago);
  const [pending, startTransition] = useTransition();
  const [nombre, setNombre] = useState(
    () => medioPago?.nombre_medio_pago ?? ""
  );
  const [tipo, setTipo] = useState(() => medioPago?.tipo ?? "");
  const [requiereReferencia, setRequiereReferencia] = useState(
    () => medioPago?.requiere_referencia ?? false
  );
  const [cuentasSel, setCuentasSel] = useState(
    () => new Set((medioPago?.cuentas ?? []).map((c) => c.id_cuenta))
  );
  const [errorNombre, setErrorNombre] = useState(null);
  const [errorTipo, setErrorTipo] = useState(null);
  const [errorServer, setErrorServer] = useState(null);
  const nombreRef = useRef(null);

  useEffect(() => {
    nombreRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggleCuenta(id) {
    setCuentasSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function validar() {
    let ok = true;
    if (nombre.trim().length === 0) {
      setErrorNombre("El nombre es obligatorio.");
      ok = false;
    } else {
      setErrorNombre(null);
    }
    if (!TIPOS_MEDIO_PAGO.includes(tipo)) {
      setErrorTipo("Elegí el tipo del medio de pago.");
      ok = false;
    } else {
      setErrorTipo(null);
    }
    return ok;
  }

  function onSubmit(e) {
    e.preventDefault();
    setErrorServer(null);
    if (!validar()) return;

    const formData = new FormData();
    formData.set("nombre_medio_pago", nombre.trim());
    formData.set("tipo", tipo);
    if (requiereReferencia) {
      formData.set("requiere_referencia", "on");
    }
    for (const id of cuentasSel) {
      formData.append("cuentas", id);
    }

    startTransition(async () => {
      const result = isEdit
        ? await actualizarMedioPago(medioPago.id_medio_pago, formData)
        : await crearMedioPago(formData);

      if (!result.ok) {
        const ui = mapErrorMedioPago(result);
        if (ui.field === "nombre") {
          setErrorNombre(ui.message);
        } else if (ui.field === "tipo") {
          setErrorTipo(ui.message);
        } else {
          setErrorServer(ui.message);
        }
        if (ui.reload) router.refresh();
        return;
      }

      onClose();
      router.refresh();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="medio-pago-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="palacio-card w-full max-w-md p-5 md:p-6">
        <h2
          id="medio-pago-modal-title"
          className="mb-5 text-sm font-semibold text-zinc-900"
        >
          {isEdit ? "Editar medio de pago" : "Nuevo medio de pago"}
        </h2>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="medio-pago-nombre"
              className="text-sm font-medium text-zinc-800"
            >
              Nombre <span className="text-palacio-red">*</span>
            </label>
            <input
              id="medio-pago-nombre"
              ref={nombreRef}
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="palacio-input"
              placeholder="Ej. Efectivo, Transferencia, Cheque"
              maxLength={80}
            />
            {errorNombre ? (
              <p className="text-xs text-red-600">{errorNombre}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="medio-pago-tipo"
              className="text-sm font-medium text-zinc-800"
            >
              Tipo <span className="text-palacio-red">*</span>
            </label>
            <select
              id="medio-pago-tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="palacio-input"
            >
              <option value="">Elegí un tipo…</option>
              {TIPOS_MEDIO_PAGO.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {errorTipo ? (
              <p className="text-xs text-red-600">{errorTipo}</p>
            ) : null}
          </div>

          <label className="flex items-start gap-2.5 rounded-lg border border-palacio-border bg-zinc-50 px-4 py-3 text-sm text-zinc-800">
            <input
              type="checkbox"
              checked={requiereReferencia}
              onChange={(e) => setRequiereReferencia(e.target.checked)}
              className="mt-0.5 size-4 rounded border-zinc-300 accent-palacio-red"
            />
            <span>
              <span className="font-medium">Requiere referencia</span>
              <span className="mt-0.5 block text-xs text-palacio-muted">
                Si está marcado, al usar este medio se pedirá un número de
                referencia (ej. transferencia o cheque).
              </span>
            </span>
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-800">
              Cuentas de tesorería habilitadas
            </span>
            <p className="text-xs text-palacio-muted">
              Cuentas concretas que este medio puede usar al registrar una orden
              o un pago.
            </p>
            {cuentasDisponibles.length === 0 ? (
              <p className="rounded-lg border border-palacio-border bg-zinc-50 px-3 py-2 text-xs text-palacio-muted">
                No hay cuentas de tesorería activas. Cargá cuentas para poder
                habilitarlas.
              </p>
            ) : (
              <div className="max-h-44 overflow-y-auto rounded-lg border border-palacio-border">
                {cuentasDisponibles.map((c) => (
                  <label
                    key={c.id_cuenta}
                    className="flex items-center gap-2.5 border-b border-palacio-border px-3 py-2 text-sm text-zinc-800 last:border-0"
                  >
                    <input
                      type="checkbox"
                      checked={cuentasSel.has(c.id_cuenta)}
                      onChange={() => toggleCuenta(c.id_cuenta)}
                      className="size-4 rounded border-zinc-300 accent-palacio-red"
                    />
                    <span className="font-medium">{c.nombre_cuenta}</span>
                    <span className="text-xs text-palacio-muted">{c.tipo}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {errorServer ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorServer}
            </p>
          ) : null}

          <div className="mt-1 flex flex-wrap gap-2 border-t border-palacio-border pt-4">
            <button
              type="submit"
              disabled={pending}
              className="palacio-btn-primary px-4 py-2.5 text-sm"
            >
              {pending
                ? "Guardando…"
                : isEdit
                  ? "Guardar cambios"
                  : "Crear medio de pago"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="palacio-btn-secondary px-4 py-2.5 text-sm"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
