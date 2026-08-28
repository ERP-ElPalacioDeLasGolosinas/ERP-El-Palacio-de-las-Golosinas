"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  actualizarTipoMovimiento,
  crearTipoMovimiento,
} from "@/lib/tipos-movimiento/actions";
import { mapErrorTipoMovimiento } from "@/lib/tipos-movimiento/errores";

/**
 * Modal de alta / edición de tipo de movimiento. Se monta sólo cuando está
 * abierto; el padre le pasa `key` para arrancar con estado fresco.
 *
 * @param {{
 *   onClose: () => void,
 *   tipoMovimiento?: {
 *     id_tipo_movimiento: string,
 *     nombre: string,
 *     signo: number,
 *     requiere_control_stock: boolean,
 *   } | null,
 * }} props
 */
export function TipoMovimientoFormModal({ onClose, tipoMovimiento = null }) {
  const router = useRouter();
  const isEdit = Boolean(tipoMovimiento?.id_tipo_movimiento);
  const [pending, startTransition] = useTransition();
  const [nombre, setNombre] = useState(() => tipoMovimiento?.nombre ?? "");
  const [signo, setSigno] = useState(() =>
    tipoMovimiento?.signo != null ? String(tipoMovimiento.signo) : "",
  );
  const [requiereControlStock, setRequiereControlStock] = useState(
    () => tipoMovimiento?.requiere_control_stock ?? true,
  );
  const [errorNombre, setErrorNombre] = useState(null);
  const [errorSigno, setErrorSigno] = useState(null);
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

  function validar() {
    let ok = true;

    if (nombre.trim().length === 0) {
      setErrorNombre("El nombre es obligatorio.");
      ok = false;
    } else {
      setErrorNombre(null);
    }

    if (signo !== "1" && signo !== "-1") {
      setErrorSigno("Debés seleccionar el signo (entrada o salida).");
      ok = false;
    } else {
      setErrorSigno(null);
    }

    return ok;
  }

  function onSubmit(e) {
    e.preventDefault();
    setErrorServer(null);
    if (!validar()) return;

    const formData = new FormData();
    formData.set("nombre", nombre.trim());
    formData.set("signo", signo);
    if (requiereControlStock) formData.set("requiere_control_stock", "on");

    startTransition(async () => {
      const result = isEdit
        ? await actualizarTipoMovimiento(
            tipoMovimiento.id_tipo_movimiento,
            formData,
          )
        : await crearTipoMovimiento(formData);

      if (!result.ok) {
        const ui = mapErrorTipoMovimiento(result);
        if (ui.field === "nombre") {
          setErrorNombre(ui.message);
        } else if (ui.field === "signo") {
          setErrorSigno(ui.message);
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
      aria-labelledby="tipo-movimiento-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="palacio-card w-full max-w-md p-5 md:p-6">
        <h2
          id="tipo-movimiento-modal-title"
          className="mb-5 text-sm font-semibold text-zinc-900"
        >
          {isEdit ? "Editar tipo de movimiento" : "Nuevo tipo de movimiento"}
        </h2>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="tipo-movimiento-nombre"
              className="text-sm font-medium text-zinc-800"
            >
              Nombre <span className="text-palacio-red">*</span>
            </label>
            <input
              id="tipo-movimiento-nombre"
              ref={nombreRef}
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="palacio-input"
              placeholder="Ej. Ingreso por compra"
              maxLength={80}
            />
            {errorNombre ? (
              <p className="text-xs text-red-600">{errorNombre}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="tipo-movimiento-signo"
              className="text-sm font-medium text-zinc-800"
            >
              Signo <span className="text-palacio-red">*</span>
            </label>
            <select
              id="tipo-movimiento-signo"
              value={signo}
              onChange={(e) => setSigno(e.target.value)}
              className="palacio-input"
            >
              <option value="" disabled>
                Seleccionar…
              </option>
              <option value="1">Entrada (+1)</option>
              <option value="-1">Salida (-1)</option>
            </select>
            {errorSigno ? (
              <p className="text-xs text-red-600">{errorSigno}</p>
            ) : null}
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={requiereControlStock}
              onChange={(e) => setRequiereControlStock(e.target.checked)}
              className="size-4 accent-palacio-red"
            />
            Requiere control de stock
          </label>

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
                  : "Crear tipo de movimiento"}
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
