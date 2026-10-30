"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actualizarUsuario, crearUsuario } from "@/lib/usuarios/actions";
import { ROL_LABEL, ROLES_EMPLEADO } from "@/lib/usuarios/constantes";
import { mapErrorUsuario } from "@/lib/usuarios/errores";

const MAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EDAD_MINIMA = 16;

const ERRORES_VACIOS = {
  nombre: null,
  apellido: null,
  dni: null,
  fecha: null,
  telefono: null,
  rol: null,
  mail: null,
  password: null,
};

/** Fecha máxima de nacimiento (hoy menos EDAD_MINIMA años), en formato yyyy-mm-dd. */
function fechaMaxima() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - EDAD_MINIMA);
  return d.toISOString().slice(0, 10);
}

/**
 * @param {{
 *   onClose: () => void,
 *   usuario?: {
 *     id_usuario: string,
 *     nombre_usuario: string,
 *     apellido_usuario: string,
 *     fecha_nacimiento_usuario: string,
 *     dni_usuario: number,
 *     telefono_usuario: string,
 *     mail_usuario: string,
 *     rol_usuario: string,
 *   } | null,
 * }} props
 */
export function UsuarioFormModal({ onClose, usuario = null }) {
  const router = useRouter();
  const isEdit = Boolean(usuario?.id_usuario);
  const [pending, startTransition] = useTransition();

  const [nombre, setNombre] = useState(() => usuario?.nombre_usuario ?? "");
  const [apellido, setApellido] = useState(() => usuario?.apellido_usuario ?? "");
  const [dni, setDni] = useState(() => String(usuario?.dni_usuario ?? ""));
  const [fecha, setFecha] = useState(() => usuario?.fecha_nacimiento_usuario ?? "");
  const [telefono, setTelefono] = useState(() => soloDigitos(usuario?.telefono_usuario));
  const [rol, setRol] = useState(() => usuario?.rol_usuario ?? "");
  const [mail, setMail] = useState(() => usuario?.mail_usuario ?? "");
  const [password, setPassword] = useState("");

  const [errores, setErrores] = useState(ERRORES_VACIOS);
  const [errorServer, setErrorServer] = useState(null);
  const nombreRef = useRef(null);
  const maxFecha = fechaMaxima();

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

    if (nombre.trim().length === 0) next.nombre = "El nombre es obligatorio.";
    if (apellido.trim().length === 0) next.apellido = "El apellido es obligatorio.";
    if (!/^\d{7,8}$/.test(dni)) next.dni = "El DNI debe tener entre 7 y 8 dígitos.";
    if (!fecha || fecha > maxFecha) {
      next.fecha = `El empleado debe tener al menos ${EDAD_MINIMA} años.`;
    }
    if (!/^\d{6,15}$/.test(telefono)) {
      next.telefono = "El teléfono debe tener entre 6 y 15 dígitos.";
    }
    if (!ROLES_EMPLEADO.includes(rol)) next.rol = "Elegí un rol.";

    if (!isEdit) {
      if (!MAIL_RE.test(mail.trim())) next.mail = "Ingresá un correo electrónico válido.";
      if (password.length < 8) {
        next.password = "La contraseña debe tener al menos 8 caracteres.";
      }
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
    formData.set("nombre_usuario", nombre.trim());
    formData.set("apellido_usuario", apellido.trim());
    formData.set("dni_usuario", dni);
    formData.set("fecha_nacimiento_usuario", fecha);
    formData.set("telefono_usuario", telefono);
    formData.set("rol_usuario", rol);
    if (!isEdit) {
      formData.set("mail_usuario", mail.trim().toLowerCase());
      formData.set("password", password);
    }

    startTransition(async () => {
      const result = isEdit
        ? await actualizarUsuario(usuario.id_usuario, formData)
        : await crearUsuario(formData);

      if (!result.ok) {
        const ui = mapErrorUsuario(result);
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
      aria-labelledby="usuario-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="palacio-card max-h-full w-full max-w-lg overflow-y-auto p-5 md:p-6">
        <h2
          id="usuario-modal-title"
          className="mb-5 text-sm font-semibold text-zinc-900"
        >
          {isEdit ? "Editar usuario" : "Nuevo usuario"}
        </h2>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Nombre" htmlFor="usuario-nombre" required error={errores.nombre}>
              <input
                id="usuario-nombre"
                ref={nombreRef}
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="palacio-input"
                maxLength={80}
              />
            </Campo>

            <Campo label="Apellido" htmlFor="usuario-apellido" required error={errores.apellido}>
              <input
                id="usuario-apellido"
                type="text"
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
                className="palacio-input"
                maxLength={80}
              />
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              label="DNI"
              htmlFor="usuario-dni"
              required
              hint="Solo números, 7 u 8 dígitos."
              error={errores.dni}
            >
              <input
                id="usuario-dni"
                type="text"
                inputMode="numeric"
                value={dni}
                onChange={(e) => setDni(soloDigitos(e.target.value).slice(0, 8))}
                className="palacio-input font-mono"
                placeholder="30123456"
                autoComplete="off"
                maxLength={8}
              />
            </Campo>

            <Campo
              label="Fecha de nacimiento"
              htmlFor="usuario-fecha"
              required
              error={errores.fecha}
            >
              <input
                id="usuario-fecha"
                type="date"
                value={fecha}
                max={maxFecha}
                onChange={(e) => setFecha(e.target.value)}
                className="palacio-input"
              />
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              label="Teléfono"
              htmlFor="usuario-telefono"
              required
              hint="Solo números, entre 6 y 15 dígitos."
              error={errores.telefono}
            >
              <input
                id="usuario-telefono"
                type="tel"
                inputMode="numeric"
                value={telefono}
                onChange={(e) => setTelefono(soloDigitos(e.target.value).slice(0, 15))}
                className="palacio-input"
                placeholder="1155555555"
                maxLength={15}
              />
            </Campo>

            <Campo label="Rol" htmlFor="usuario-rol" required error={errores.rol}>
              <select
                id="usuario-rol"
                value={rol}
                onChange={(e) => setRol(e.target.value)}
                className="palacio-input"
              >
                <option value="">Seleccioná…</option>
                {ROLES_EMPLEADO.map((r) => (
                  <option key={r} value={r}>
                    {ROL_LABEL[r]}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          <Campo
            label="Correo electrónico"
            htmlFor="usuario-mail"
            required={!isEdit}
            hint={isEdit ? "Es el usuario de ingreso; no se puede cambiar." : null}
            error={errores.mail}
          >
            <input
              id="usuario-mail"
              type="email"
              value={mail}
              onChange={(e) => setMail(e.target.value)}
              disabled={isEdit}
              className="palacio-input disabled:bg-zinc-50 disabled:text-palacio-muted"
              placeholder="empleado@palacio.com"
              autoComplete="off"
              maxLength={120}
            />
          </Campo>

          {!isEdit ? (
            <Campo
              label="Contraseña inicial"
              htmlFor="usuario-password"
              required
              hint="Mínimo 8 caracteres. Pasásela al empleado para su primer ingreso."
              error={errores.password}
            >
              <input
                id="usuario-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="palacio-input"
                autoComplete="new-password"
              />
            </Campo>
          ) : null}

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
              {pending ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear usuario"}
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
