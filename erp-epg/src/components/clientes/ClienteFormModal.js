"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  actualizarCliente,
  crearCliente,
} from "@/lib/clientes/actions";
import { mapErrorCliente } from "@/lib/clientes/errores";

const DNI_RE = /^[0-9]{7,8}$/;
const CUIT_RE = /^[0-9]{2}-[0-9]{8}-[0-9]$/;
const TELEFONO_RE = /^[0-9]{6,15}$/;
const MAIL_RE =
  /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

const ERRORES_VACIOS = {
  nombre: null,
  tipo: null,
  documento: null,
  telefono: null,
  mail: null,
};

/**
 * @param {{
 *   onClose: () => void,
 *   cliente?: {
 *     id_cliente: string,
 *     nombre_cliente: string,
 *     id_tipo_cliente: string,
 *     nombre_tipo_cliente?: string,
 *     lista_precio?: string,
 *     documento_cliente: string | null,
 *     telefono_cliente: string | null,
 *     mail_cliente: string | null,
 *     direccion_cliente: string | null,
 *   } | null,
 *   tiposActivos: Array<{
 *     id_tipo_cliente: string,
 *     nombre_tipo_cliente: string,
 *     lista_precio: string,
 *     activo: boolean,
 *   }>,
 * }} props
 */
export function ClienteFormModal({
  onClose,
  cliente = null,
  tiposActivos = [],
}) {
  const router = useRouter();
  const isEdit = Boolean(cliente?.id_cliente);
  const [pending, startTransition] = useTransition();

  const [nombre, setNombre] = useState(() => cliente?.nombre_cliente ?? "");
  const [idTipo, setIdTipo] = useState(() => cliente?.id_tipo_cliente ?? "");
  const [documento, setDocumento] = useState(
    () => cliente?.documento_cliente ?? ""
  );
  const [telefono, setTelefono] = useState(() =>
    soloDigitos(String(cliente?.telefono_cliente ?? ""))
  );
  const [mail, setMail] = useState(() => cliente?.mail_cliente ?? "");
  const [direccion, setDireccion] = useState(
    () => cliente?.direccion_cliente ?? ""
  );

  const [errores, setErrores] = useState(ERRORES_VACIOS);
  const [errorServer, setErrorServer] = useState(null);
  const nombreRef = useRef(null);

  const opcionesTipo = useMemo(() => {
    const map = new Map(
      tiposActivos.map((t) => [t.id_tipo_cliente, t])
    );
    // Si el tipo actual está inactivo, igual se ofrece para conservar al editar.
    if (
      isEdit &&
      cliente?.id_tipo_cliente &&
      !map.has(cliente.id_tipo_cliente)
    ) {
      map.set(cliente.id_tipo_cliente, {
        id_tipo_cliente: cliente.id_tipo_cliente,
        nombre_tipo_cliente:
          cliente.nombre_tipo_cliente ?? "Tipo actual (inhabilitado)",
        lista_precio: cliente.lista_precio ?? "",
        activo: false,
      });
    }
    return Array.from(map.values());
  }, [tiposActivos, isEdit, cliente]);

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
    const next = { ...ERRORES_VACIOS };
    const doc = normalizarDocumento(documento);

    if (nombre.trim().length === 0) {
      next.nombre = "El nombre es obligatorio.";
    }
    if (!idTipo) {
      next.tipo = "Elegí un tipo de cliente.";
    }
    if (!DNI_RE.test(doc) && !CUIT_RE.test(doc)) {
      next.documento =
        "Ingresá un DNI (7 u 8 dígitos) o un CUIT XX-XXXXXXXX-X.";
    }
    if (!TELEFONO_RE.test(telefono)) {
      next.telefono = "El teléfono debe tener entre 6 y 15 dígitos.";
    }
    const mailTrim = mail.trim();
    if (mailTrim && !MAIL_RE.test(mailTrim)) {
      next.mail = "Ingresá un correo electrónico válido.";
    }

    setErrores(next);
    return Object.values(next).every((v) => v == null);
  }

  function aplicarErrorCampo(field, message) {
    if (!field) return false;
    setErrores((prev) => ({ ...prev, [field]: message }));
    return true;
  }

  function onSubmit(e) {
    e.preventDefault();
    setErrorServer(null);
    if (!validar()) return;

    const formData = new FormData();
    formData.set("nombre_cliente", nombre.trim());
    formData.set("id_tipo_cliente", idTipo);
    formData.set("documento_cliente", normalizarDocumento(documento));
    formData.set("telefono_cliente", telefono);
    if (mail.trim()) formData.set("mail_cliente", mail.trim().toLowerCase());
    if (direccion.trim()) formData.set("direccion_cliente", direccion.trim());

    startTransition(async () => {
      const result = isEdit
        ? await actualizarCliente(cliente.id_cliente, formData)
        : await crearCliente(formData);

      if (!result.ok) {
        const ui = mapErrorCliente(result);
        if (!aplicarErrorCampo(ui.field, ui.message)) {
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
      aria-labelledby="cliente-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="palacio-card w-full max-w-lg p-5 md:p-6">
        <h2
          id="cliente-modal-title"
          className="mb-5 text-sm font-semibold text-zinc-900"
        >
          {isEdit ? "Editar cliente" : "Nuevo cliente"}
        </h2>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Campo
            label="Nombre"
            htmlFor="cliente-nombre"
            required
            error={errores.nombre}
          >
            <input
              id="cliente-nombre"
              ref={nombreRef}
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="palacio-input"
              placeholder="Ej. Kiosco Don Pepe"
              maxLength={120}
            />
          </Campo>

          <Campo
            label="Tipo de cliente"
            htmlFor="cliente-tipo"
            required
            error={errores.tipo}
          >
            <select
              id="cliente-tipo"
              value={idTipo}
              onChange={(e) => setIdTipo(e.target.value)}
              className="palacio-input"
            >
              <option value="">Seleccioná…</option>
              {opcionesTipo.map((t) => (
                <option key={t.id_tipo_cliente} value={t.id_tipo_cliente}>
                  {t.nombre_tipo_cliente}
                  {t.lista_precio ? ` (${t.lista_precio})` : ""}
                  {t.activo === false ? " — inhabilitado" : ""}
                </option>
              ))}
            </select>
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              label="Documento"
              htmlFor="cliente-documento"
              required
              hint="DNI (7–8 dígitos) o CUIT XX-XXXXXXXX-X."
              error={errores.documento}
            >
              <input
                id="cliente-documento"
                type="text"
                value={documento}
                onChange={(e) => setDocumento(formatearDocumento(e.target.value))}
                className="palacio-input font-mono"
                placeholder="20123456 o 20-12345678-9"
                autoComplete="off"
                maxLength={13}
              />
            </Campo>

            <Campo
              label="Teléfono"
              htmlFor="cliente-telefono"
              required
              hint="Solo números, entre 6 y 15 dígitos."
              error={errores.telefono}
            >
              <input
                id="cliente-telefono"
                type="tel"
                inputMode="numeric"
                value={telefono}
                onChange={(e) =>
                  setTelefono(soloDigitos(e.target.value).slice(0, 15))
                }
                className="palacio-input"
                placeholder="3874123456"
                maxLength={15}
              />
            </Campo>
          </div>

          <Campo
            label="Correo electrónico"
            htmlFor="cliente-mail"
            error={errores.mail}
          >
            <input
              id="cliente-mail"
              type="email"
              value={mail}
              onChange={(e) => setMail(e.target.value)}
              className="palacio-input"
              placeholder="opcional@mail.com"
              autoComplete="email"
              maxLength={120}
            />
          </Campo>

          <Campo label="Dirección" htmlFor="cliente-direccion">
            <input
              id="cliente-direccion"
              type="text"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              className="palacio-input"
              placeholder="Opcional"
              maxLength={200}
            />
          </Campo>

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
                  : "Crear cliente"}
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

function Campo({
  label,
  htmlFor,
  required = false,
  hint = null,
  error = null,
  children,
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-zinc-800">
        {label} {required ? <span className="text-palacio-red">*</span> : null}
      </label>
      {children}
      {hint ? <p className="text-xs text-palacio-muted">{hint}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

function soloDigitos(value) {
  return String(value ?? "").replace(/\D/g, "");
}

/** Quita puntos del DNI; si parece CUIT, formatea XX-XXXXXXXX-X. */
function formatearDocumento(value) {
  const limpio = String(value ?? "").replace(/\./g, "");
  const digitos = soloDigitos(limpio);
  // Si el usuario escribe guiones o ya van 9+ dígitos, tratamos como CUIT.
  if (limpio.includes("-") || digitos.length > 8) {
    const d = digitos.slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 10) return `${d.slice(0, 2)}-${d.slice(2)}`;
    return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
  }
  return digitos.slice(0, 8);
}

function normalizarDocumento(value) {
  const limpio = String(value ?? "").replace(/\./g, "").trim();
  const digitos = soloDigitos(limpio);
  if (DNI_RE.test(digitos) && !limpio.includes("-")) return digitos;
  if (CUIT_RE.test(limpio)) return limpio;
  // Reconstruir CUIT si vino sin guiones completos
  if (digitos.length === 11) {
    return `${digitos.slice(0, 2)}-${digitos.slice(2, 10)}-${digitos.slice(10)}`;
  }
  return limpio;
}
