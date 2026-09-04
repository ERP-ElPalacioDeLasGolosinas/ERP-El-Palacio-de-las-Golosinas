"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  actualizarTipoComprobante,
  crearTipoComprobante,
} from "@/lib/tipos-comprobante/actions";
import { mapErrorTipoComprobante } from "@/lib/tipos-comprobante/errores";

/**
 * Modal de alta / edición de tipo de comprobante (C-06: compras).
 * No expone aplica_venta / aplica_pago (quedan en default o se conservan al editar).
 *
 * @param {{
 *   onClose: () => void,
 *   tipoComprobante?: {
 *     id_tipo_comprobante: string,
 *     nombre_tipo_comprobante: string,
 *     letra: string | null,
 *     es_fiscal: boolean,
 *     signo: number,
 *     aplica_venta?: boolean,
 *     aplica_pago?: boolean,
 *   } | null,
 * }} props
 */
export function TipoComprobanteFormModal({
  onClose,
  tipoComprobante = null,
}) {
  const router = useRouter();
  const isEdit = Boolean(tipoComprobante?.id_tipo_comprobante);
  const [pending, startTransition] = useTransition();
  const [nombre, setNombre] = useState(
    () => tipoComprobante?.nombre_tipo_comprobante ?? ""
  );
  const [letra, setLetra] = useState(() =>
    tipoComprobante?.letra ? String(tipoComprobante.letra).toUpperCase() : ""
  );
  const [signo, setSigno] = useState(() =>
    tipoComprobante?.signo != null ? String(tipoComprobante.signo) : ""
  );
  const [esFiscal, setEsFiscal] = useState(
    () => tipoComprobante?.es_fiscal ?? true
  );
  const [errorNombre, setErrorNombre] = useState(null);
  const [errorSigno, setErrorSigno] = useState(null);
  const [errorLetra, setErrorLetra] = useState(null);
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
      setErrorSigno("Debés seleccionar el signo.");
      ok = false;
    } else {
      setErrorSigno(null);
    }

    if (letra && letra !== "A" && letra !== "B" && letra !== "C") {
      setErrorLetra("La letra debe ser A, B o C (o dejarse vacía).");
      ok = false;
    } else {
      setErrorLetra(null);
    }

    return ok;
  }

  function onSubmit(e) {
    e.preventDefault();
    setErrorServer(null);
    if (!validar()) return;

    const formData = new FormData();
    formData.set("nombre_tipo_comprobante", nombre.trim());
    formData.set("signo", signo);
    if (letra) formData.set("letra", letra);
    if (esFiscal) formData.set("es_fiscal", "on");
    if (isEdit && tipoComprobante?.aplica_venta) {
      formData.set("aplica_venta", "on");
    }
    if (isEdit && tipoComprobante?.aplica_pago) {
      formData.set("aplica_pago", "on");
    }

    startTransition(async () => {
      const result = isEdit
        ? await actualizarTipoComprobante(
            tipoComprobante.id_tipo_comprobante,
            formData
          )
        : await crearTipoComprobante(formData);

      if (!result.ok) {
        const ui = mapErrorTipoComprobante(result);
        if (ui.field === "nombre") {
          setErrorNombre(ui.message);
        } else if (ui.field === "signo") {
          setErrorSigno(ui.message);
        } else if (ui.field === "letra") {
          setErrorLetra(ui.message);
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
      aria-labelledby="tipo-comprobante-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="palacio-card w-full max-w-md p-5 md:p-6">
        <h2
          id="tipo-comprobante-modal-title"
          className="mb-5 text-sm font-semibold text-zinc-900"
        >
          {isEdit
            ? "Editar tipo de comprobante"
            : "Nuevo tipo de comprobante"}
        </h2>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="tipo-comprobante-nombre"
              className="text-sm font-medium text-zinc-800"
            >
              Nombre <span className="text-palacio-red">*</span>
            </label>
            <input
              id="tipo-comprobante-nombre"
              ref={nombreRef}
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="palacio-input"
              placeholder="Ej. Factura A, Nota de Crédito, Remito"
              maxLength={80}
            />
            {errorNombre ? (
              <p className="text-xs text-red-600">{errorNombre}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="tipo-comprobante-letra"
                className="text-sm font-medium text-zinc-800"
              >
                Letra
              </label>
              <select
                id="tipo-comprobante-letra"
                value={letra}
                onChange={(e) => setLetra(e.target.value)}
                className="palacio-input"
              >
                <option value="">Sin letra</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
              {errorLetra ? (
                <p className="text-xs text-red-600">{errorLetra}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="tipo-comprobante-signo"
                className="text-sm font-medium text-zinc-800"
              >
                Signo <span className="text-palacio-red">*</span>
              </label>
              <select
                id="tipo-comprobante-signo"
                value={signo}
                onChange={(e) => setSigno(e.target.value)}
                className="palacio-input"
              >
                <option value="" disabled>
                  Seleccionar…
                </option>
                <option value="1">Suma al saldo (+1)</option>
                <option value="-1">Resta del saldo (-1)</option>
              </select>
              {errorSigno ? (
                <p className="text-xs text-red-600">{errorSigno}</p>
              ) : null}
            </div>
          </div>

          <label className="flex items-start gap-2.5 rounded-lg border border-palacio-border bg-zinc-50 px-4 py-3 text-sm text-zinc-800">
            <input
              type="checkbox"
              checked={esFiscal}
              onChange={(e) => setEsFiscal(e.target.checked)}
              className="mt-0.5 size-4 rounded border-zinc-300 accent-palacio-red"
            />
            <span>
              <span className="font-medium">Es fiscal</span>
              <span className="mt-0.5 block text-xs text-palacio-muted">
                Documentos que importan a AFIP. Desmarcar para control interno
                (ej. remitos).
              </span>
            </span>
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
                  : "Crear tipo de comprobante"}
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
