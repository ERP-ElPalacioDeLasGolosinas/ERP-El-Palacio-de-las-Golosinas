"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  actualizarDeposito,
  crearDeposito,
} from "@/lib/depositos/actions";

const PATH = "/inventario/depositos";

/** Teléfono argentino sin prefijo país: exactamente 10 dígitos. */
const TELEFONO_RE = /^\d{10}$/;
/** Calle, número, localidad — tres partes no vacías separadas por coma. */
const DIRECCION_RE = /^[^,]+,\s*[^,]+,\s*[^,]+$/;
/** UUID opcional del responsable. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ERRORES_VACIOS = {
  nombre_deposito: null,
  telefono_deposito: null,
  direccion_deposito: null,
  id_responsable: null,
  horario_apertura: null,
  horario_cierre: null,
};

/**
 * @param {{ deposito?: {
 *   id_deposito: string,
 *   nombre_deposito: string,
 *   direccion_deposito: string | null,
 *   telefono_deposito: string | null,
 *   horario_apertura: string | null,
 *   horario_cierre: string | null,
 *   id_responsable: string | null,
 *   activo: boolean,
 *   esta_lleno: boolean,
 * } | null }} props
 */
export function DepositoForm({ deposito = null }) {
  const router = useRouter();
  const isEdit = Boolean(deposito?.id_deposito);
  const [pending, startTransition] = useTransition();

  const [nombre, setNombre] = useState(() => deposito?.nombre_deposito ?? "");
  const [telefono, setTelefono] = useState(() =>
    soloDigitos(deposito?.telefono_deposito ?? "")
  );
  const [direccion, setDireccion] = useState(
    () => deposito?.direccion_deposito ?? ""
  );
  const [responsable, setResponsable] = useState(
    () => deposito?.id_responsable ?? ""
  );
  const [horarioApertura, setHorarioApertura] = useState(() =>
    formatTime(deposito?.horario_apertura)
  );
  const [horarioCierre, setHorarioCierre] = useState(() =>
    formatTime(deposito?.horario_cierre)
  );

  const [errores, setErrores] = useState(ERRORES_VACIOS);
  const [errorServer, setErrorServer] = useState(null);

  /** Validación cliente, espejo UX de unidades de medida. */
  function validar() {
    const next = { ...ERRORES_VACIOS };

    if (nombre.trim().length === 0) {
      next.nombre_deposito = "El nombre es obligatorio.";
    }

    if (!TELEFONO_RE.test(telefono)) {
      next.telefono_deposito =
        "El teléfono debe tener exactamente 10 números.";
    }

    if (direccion.trim().length === 0) {
      next.direccion_deposito = "La dirección es obligatoria.";
    } else if (!DIRECCION_RE.test(direccion.trim())) {
      next.direccion_deposito =
        "La dirección debe tener el formato: Calle, número, localidad.";
    }

    if (responsable.trim() && !UUID_RE.test(responsable.trim())) {
      next.id_responsable =
        "El responsable debe ser un ID de usuario válido (UUID).";
    }

    if (!horarioApertura) {
      next.horario_apertura = "El horario de apertura es obligatorio.";
    }

    if (!horarioCierre) {
      next.horario_cierre = "El horario de cierre es obligatorio.";
    } else if (horarioApertura && horarioCierre <= horarioApertura) {
      next.horario_cierre =
        "El horario de cierre debe ser posterior al de apertura.";
    }

    setErrores(next);
    return Object.values(next).every((v) => v == null);
  }

  function onSubmit(e) {
    e.preventDefault();
    setErrorServer(null);
    if (!validar()) return;

    const formData = new FormData();
    formData.set("nombre_deposito", nombre.trim());
    formData.set("telefono_deposito", telefono);
    formData.set("direccion_deposito", direccion.trim());
    formData.set("horario_apertura", horarioApertura);
    formData.set("horario_cierre", horarioCierre);
    if (responsable.trim()) {
      formData.set("id_responsable", responsable.trim());
    }

    startTransition(async () => {
      const result = isEdit
        ? await actualizarDeposito(deposito.id_deposito, formData)
        : await crearDeposito(formData);

      if (!result.ok) {
        setErrorServer(result.error);
        return;
      }

      router.push(PATH);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="palacio-card max-w-4xl p-5 md:p-6"
    >
      <h2 className="mb-5 text-sm font-semibold text-zinc-900">
        {isEdit ? "Datos del depósito" : "Alta de depósito"}
      </h2>

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Nombre"
          htmlFor="nombre_deposito"
          required
          error={errores.nombre_deposito}
        >
          <input
            id="nombre_deposito"
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="palacio-input"
            placeholder="Ej. Depósito Central"
            maxLength={120}
          />
        </Field>

        <Field
          label="Teléfono"
          htmlFor="telefono_deposito"
          required
          hint="Solo números, exactamente 10 dígitos (ej. 1155555555)."
          error={errores.telefono_deposito}
        >
          <input
            id="telefono_deposito"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={telefono}
            onChange={(e) => setTelefono(soloDigitos(e.target.value).slice(0, 10))}
            className="palacio-input"
            placeholder="1155555555"
            maxLength={10}
          />
        </Field>

        <Field
          label="Dirección"
          htmlFor="direccion_deposito"
          required
          hint="Formato: Calle, número, localidad (ej. Av. Corrientes, 1234, CABA)."
          error={errores.direccion_deposito}
        >
          <input
            id="direccion_deposito"
            type="text"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            className="palacio-input"
            placeholder="Calle, número, localidad"
            maxLength={200}
          />
        </Field>

        <Field
          label="Responsable"
          htmlFor="id_responsable"
          hint="ID del usuario responsable (opcional)."
          error={errores.id_responsable}
        >
          <input
            id="id_responsable"
            type="text"
            value={responsable}
            onChange={(e) => setResponsable(e.target.value)}
            className="palacio-input font-mono text-sm"
            placeholder="UUID del usuario (opcional)"
            autoComplete="off"
            spellCheck={false}
          />
        </Field>

        <Field
          label="Horario de apertura"
          htmlFor="horario_apertura"
          required
          error={errores.horario_apertura}
        >
          <input
            id="horario_apertura"
            type="time"
            value={horarioApertura}
            onChange={(e) => setHorarioApertura(e.target.value)}
            className="palacio-input"
          />
        </Field>

        <Field
          label="Horario de cierre"
          htmlFor="horario_cierre"
          required
          error={errores.horario_cierre}
        >
          <input
            id="horario_cierre"
            type="time"
            value={horarioCierre}
            onChange={(e) => setHorarioCierre(e.target.value)}
            className="palacio-input"
          />
        </Field>
      </div>

      {errorServer ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorServer}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-palacio-border pt-4">
        <button
          type="submit"
          disabled={pending}
          className="palacio-btn-primary px-4 py-2.5 text-sm"
        >
          {pending
            ? "Guardando…"
            : isEdit
              ? "Guardar cambios"
              : "Crear depósito"}
        </button>
        <button
          type="button"
          onClick={() => router.push(PATH)}
          disabled={pending}
          className="palacio-btn-secondary px-4 py-2.5 text-sm"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Field({
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

function formatTime(value) {
  if (!value) {
    return "";
  }
  return String(value).slice(0, 5);
}
