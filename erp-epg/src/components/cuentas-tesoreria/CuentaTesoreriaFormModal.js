"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  actualizarCuentaTesoreria,
  crearCuentaTesoreria,
} from "@/lib/cuentas-tesoreria/actions";
import { TIPOS_CUENTA } from "@/lib/cuentas-tesoreria/constantes";
import { mapErrorCuentaTesoreria } from "@/lib/cuentas-tesoreria/errores";

/**
 * Modal de alta / edición de cuenta de tesorería.
 *
 * @param {{
 *   onClose: () => void,
 *   cuenta?: {
 *     id_cuenta: string,
 *     nombre_cuenta: string,
 *     tipo: string,
 *     descripcion: string | null,
 *     saldo_inicial: number | string,
 *   } | null,
 * }} props
 */
export function CuentaTesoreriaFormModal({ onClose, cuenta = null }) {
  const router = useRouter();
  const isEdit = Boolean(cuenta?.id_cuenta);
  const [pending, startTransition] = useTransition();
  const [nombre, setNombre] = useState(() => cuenta?.nombre_cuenta ?? "");
  const [tipo, setTipo] = useState(() => cuenta?.tipo ?? "Banco");
  const [descripcion, setDescripcion] = useState(
    () => cuenta?.descripcion ?? ""
  );
  const [saldoInicial, setSaldoInicial] = useState(
    () => (cuenta?.saldo_inicial != null ? String(cuenta.saldo_inicial) : "0")
  );
  const [errorNombre, setErrorNombre] = useState(null);
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
    if (nombre.trim().length === 0) {
      setErrorNombre("El nombre es obligatorio.");
      return false;
    }
    setErrorNombre(null);
    return true;
  }

  function onSubmit(e) {
    e.preventDefault();
    setErrorServer(null);
    if (!validar()) return;

    const formData = new FormData();
    formData.set("nombre_cuenta", nombre.trim());
    formData.set("tipo", tipo);
    formData.set("descripcion", descripcion.trim());
    if (!isEdit) {
      formData.set("saldo_inicial", saldoInicial.trim() || "0");
    }

    startTransition(async () => {
      const result = isEdit
        ? await actualizarCuentaTesoreria(cuenta.id_cuenta, formData)
        : await crearCuentaTesoreria(formData);

      if (!result.ok) {
        const ui = mapErrorCuentaTesoreria(result);
        if (ui.field === "nombre") {
          setErrorNombre(ui.message);
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
      aria-labelledby="cuenta-tesoreria-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="palacio-card w-full max-w-md p-5 md:p-6">
        <h2
          id="cuenta-tesoreria-modal-title"
          className="mb-5 text-sm font-semibold text-zinc-900"
        >
          {isEdit ? "Editar cuenta" : "Nueva cuenta"}
        </h2>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="cuenta-tesoreria-nombre"
              className="text-sm font-medium text-zinc-800"
            >
              Nombre <span className="text-palacio-red">*</span>
            </label>
            <input
              id="cuenta-tesoreria-nombre"
              ref={nombreRef}
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="palacio-input"
              placeholder="Ej. Banco Galicia CC, Caja fuerte"
              maxLength={120}
            />
            {errorNombre ? (
              <p className="text-xs text-red-600">{errorNombre}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="cuenta-tesoreria-tipo"
              className="text-sm font-medium text-zinc-800"
            >
              Tipo <span className="text-palacio-red">*</span>
            </label>
            <select
              id="cuenta-tesoreria-tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="palacio-input"
            >
              {TIPOS_CUENTA.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="cuenta-tesoreria-descripcion"
              className="text-sm font-medium text-zinc-800"
            >
              Descripción
            </label>
            <textarea
              id="cuenta-tesoreria-descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="palacio-input min-h-20"
              rows={2}
              maxLength={300}
            />
          </div>

          {isEdit ? null : (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="cuenta-tesoreria-saldo"
                className="text-sm font-medium text-zinc-800"
              >
                Saldo inicial
              </label>
              <input
                id="cuenta-tesoreria-saldo"
                type="number"
                step="0.01"
                value={saldoInicial}
                onChange={(e) => setSaldoInicial(e.target.value)}
                className="palacio-input"
              />
              <span className="text-xs text-palacio-muted">
                El saldo actual arranca igual al saldo inicial. Después solo lo
                mueven los pagos registrados.
              </span>
            </div>
          )}

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
                  : "Crear cuenta"}
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
