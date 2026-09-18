"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  actualizarTipoCliente,
  crearTipoCliente,
} from "@/lib/tipos-cliente/actions";
import { LISTAS_PRECIO } from "@/lib/tipos-cliente/constantes";
import { mapErrorTipoCliente } from "@/lib/tipos-cliente/errores";

/**
 * @param {{
 *   onClose: () => void,
 *   tipoCliente?: {
 *     id_tipo_cliente: string,
 *     nombre_tipo_cliente: string,
 *     lista_precio: string,
 *   } | null,
 * }} props
 */
export function TipoClienteFormModal({ onClose, tipoCliente = null }) {
  const router = useRouter();
  const isEdit = Boolean(tipoCliente?.id_tipo_cliente);
  const [pending, startTransition] = useTransition();
  const [nombre, setNombre] = useState(
    () => tipoCliente?.nombre_tipo_cliente ?? ""
  );
  const [listaPrecio, setListaPrecio] = useState(
    () => tipoCliente?.lista_precio ?? ""
  );
  const [errorNombre, setErrorNombre] = useState(null);
  const [errorLista, setErrorLista] = useState(null);
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
    if (!LISTAS_PRECIO.includes(/** @type {any} */ (listaPrecio))) {
      setErrorLista("Elegí una lista de precios.");
      ok = false;
    } else {
      setErrorLista(null);
    }
    return ok;
  }

  function onSubmit(e) {
    e.preventDefault();
    setErrorServer(null);
    if (!validar()) return;

    const formData = new FormData();
    formData.set("nombre_tipo_cliente", nombre.trim());
    formData.set("lista_precio", listaPrecio);

    startTransition(async () => {
      const result = isEdit
        ? await actualizarTipoCliente(tipoCliente.id_tipo_cliente, formData)
        : await crearTipoCliente(formData);

      if (!result.ok) {
        const ui = mapErrorTipoCliente(result);
        if (ui.field === "nombre") setErrorNombre(ui.message);
        else if (ui.field === "lista_precio") setErrorLista(ui.message);
        else setErrorServer(ui.message);
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
      aria-labelledby="tipo-cliente-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="palacio-card w-full max-w-md p-5 md:p-6">
        <h2
          id="tipo-cliente-modal-title"
          className="mb-5 text-sm font-semibold text-zinc-900"
        >
          {isEdit ? "Editar tipo de cliente" : "Nuevo tipo de cliente"}
        </h2>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="tipo-cliente-nombre"
              className="text-sm font-medium text-zinc-800"
            >
              Nombre <span className="text-palacio-red">*</span>
            </label>
            <input
              id="tipo-cliente-nombre"
              ref={nombreRef}
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="palacio-input"
              placeholder="Ej. Minorista, Mayorista"
              maxLength={80}
            />
            {errorNombre ? (
              <p className="text-xs text-red-600">{errorNombre}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="tipo-cliente-lista"
              className="text-sm font-medium text-zinc-800"
            >
              Lista de precios <span className="text-palacio-red">*</span>
            </label>
            <select
              id="tipo-cliente-lista"
              value={listaPrecio}
              onChange={(e) => setListaPrecio(e.target.value)}
              className="palacio-input"
            >
              <option value="">Seleccioná…</option>
              {LISTAS_PRECIO.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {opcion}
                </option>
              ))}
            </select>
            {errorLista ? (
              <p className="text-xs text-red-600">{errorLista}</p>
            ) : null}
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
                  : "Crear tipo de cliente"}
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
