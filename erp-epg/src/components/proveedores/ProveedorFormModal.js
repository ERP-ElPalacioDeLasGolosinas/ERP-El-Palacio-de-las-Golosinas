"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  actualizarProveedor,
  crearProveedor,
} from "@/lib/proveedores/actions";
import { mapErrorProveedor } from "@/lib/proveedores/errores";

export const RAZONES_SOCIALES = [
  "S.A.",
  "S.R.L.",
  "S.A.U.",
  "S.A.S.",
  "S.H.",
  "Responsable Inscripto",
  "Monotributista",
];

const CUIT_RE = /^\d{2}-\d{8}-\d$/;
const MAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TELEFONO_MIN = 100000;
const TELEFONO_MAX = 999999999999999;

const ERRORES_VACIOS = {
  nombre: null,
  rs: null,
  cuit: null,
  telefono: null,
  mail: null,
};

/**
 * @param {{
 *   onClose: () => void,
 *   proveedor?: {
 *     id_proveedor: string,
 *     nombre_proveedor: string,
 *     rs_proveedor: string,
 *     cuit_proveedor: string,
 *     telefono_proveedor: number | string,
 *     mail_proveedor: string,
 *   } | null,
 * }} props
 */
export function ProveedorFormModal({ onClose, proveedor = null }) {
  const router = useRouter();
  const isEdit = Boolean(proveedor?.id_proveedor);
  const [pending, startTransition] = useTransition();

  const [nombre, setNombre] = useState(() => proveedor?.nombre_proveedor ?? "");
  const [rs, setRs] = useState(() => proveedor?.rs_proveedor ?? "");
  const [cuit, setCuit] = useState(() => proveedor?.cuit_proveedor ?? "");
  const [telefono, setTelefono] = useState(() =>
    soloDigitos(String(proveedor?.telefono_proveedor ?? ""))
  );
  const [mail, setMail] = useState(() => proveedor?.mail_proveedor ?? "");

  const [errores, setErrores] = useState(ERRORES_VACIOS);
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
    const next = { ...ERRORES_VACIOS };

    if (nombre.trim().length === 0) {
      next.nombre = "El nombre es obligatorio.";
    }
    if (!rs) {
      next.rs = "Elegí una razón social.";
    }
    if (!CUIT_RE.test(cuit.trim())) {
      next.cuit = "El CUIT debe tener el formato XX-XXXXXXXX-X.";
    }

    const telNum = Number(telefono);
    if (
      !telefono ||
      !Number.isFinite(telNum) ||
      telNum < TELEFONO_MIN ||
      telNum > TELEFONO_MAX
    ) {
      next.telefono = "El teléfono debe tener entre 6 y 15 dígitos.";
    }

    if (!MAIL_RE.test(mail.trim())) {
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
    formData.set("nombre_proveedor", nombre.trim());
    formData.set("rs_proveedor", rs);
    formData.set("cuit_proveedor", cuit.trim());
    formData.set("telefono_proveedor", telefono);
    formData.set("mail_proveedor", mail.trim().toLowerCase());

    startTransition(async () => {
      const result = isEdit
        ? await actualizarProveedor(proveedor.id_proveedor, formData)
        : await crearProveedor(formData);

      if (!result.ok) {
        const ui = mapErrorProveedor(result);
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
      aria-labelledby="proveedor-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="palacio-card w-full max-w-lg p-5 md:p-6">
        <h2
          id="proveedor-modal-title"
          className="mb-5 text-sm font-semibold text-zinc-900"
        >
          {isEdit ? "Editar proveedor" : "Nuevo proveedor"}
        </h2>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Campo
            label="Nombre"
            htmlFor="proveedor-nombre"
            required
            error={errores.nombre}
          >
            <input
              id="proveedor-nombre"
              ref={nombreRef}
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="palacio-input"
              placeholder="Ej. Distribuidora Norte"
              maxLength={120}
            />
          </Campo>

          <Campo
            label="Razón social"
            htmlFor="proveedor-rs"
            required
            error={errores.rs}
          >
            <select
              id="proveedor-rs"
              value={rs}
              onChange={(e) => setRs(e.target.value)}
              className="palacio-input"
            >
              <option value="">Seleccioná…</option>
              {RAZONES_SOCIALES.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {opcion}
                </option>
              ))}
            </select>
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              label="CUIT"
              htmlFor="proveedor-cuit"
              required
              hint="Formato XX-XXXXXXXX-X."
              error={errores.cuit}
            >
              <input
                id="proveedor-cuit"
                type="text"
                value={cuit}
                onChange={(e) => setCuit(formatearCuit(e.target.value))}
                className="palacio-input font-mono"
                placeholder="20-12345678-9"
                inputMode="numeric"
                autoComplete="off"
                maxLength={13}
              />
            </Campo>

            <Campo
              label="Teléfono"
              htmlFor="proveedor-telefono"
              required
              hint="Solo números, entre 6 y 15 dígitos."
              error={errores.telefono}
            >
              <input
                id="proveedor-telefono"
                type="tel"
                inputMode="numeric"
                value={telefono}
                onChange={(e) =>
                  setTelefono(soloDigitos(e.target.value).slice(0, 15))
                }
                className="palacio-input"
                placeholder="1155555555"
                maxLength={15}
              />
            </Campo>
          </div>

          <Campo
            label="Correo electrónico"
            htmlFor="proveedor-mail"
            required
            error={errores.mail}
          >
            <input
              id="proveedor-mail"
              type="email"
              value={mail}
              onChange={(e) => setMail(e.target.value)}
              className="palacio-input"
              placeholder="contacto@proveedor.com"
              autoComplete="email"
              maxLength={120}
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
                  : "Crear proveedor"}
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

/** Inserta guiones al formato XX-XXXXXXXX-X mientras se escribe. */
function formatearCuit(value) {
  const digitos = soloDigitos(value).slice(0, 11);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 10) {
    return `${digitos.slice(0, 2)}-${digitos.slice(2)}`;
  }
  return `${digitos.slice(0, 2)}-${digitos.slice(2, 10)}-${digitos.slice(10)}`;
}
