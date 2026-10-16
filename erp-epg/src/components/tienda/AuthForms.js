"use client";

import { useActionState, useEffect } from "react";
import { loginTienda } from "@/app/(tienda)/tienda/login/actions";
import { registrarClienteWeb } from "@/app/(tienda)/tienda/registro/actions";

const CAMPOS_REGISTRO = [
  { name: "nombre", label: "Nombre y apellido", type: "text", autoComplete: "name" },
  { name: "email", label: "Email", type: "email", autoComplete: "email" },
  { name: "password", label: "Contraseña (mínimo 8 caracteres)", type: "password", autoComplete: "new-password" },
];

function Mensajes({ state }) {
  return (
    <>
      {state?.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      ) : null}
      {state?.aviso ? (
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{state.aviso}</p>
      ) : null}
    </>
  );
}

// Formularios compartidos entre las páginas /login y /registro (modal=false: la acción
// redirige) y el AuthModal (modal=true: la acción devuelve { ok: true } y se llama a onOk).
export function FormularioLogin({ modal = false, next = "", onOk }) {
  const [state, formAction, pending] = useActionState(loginTienda, { error: null });
  useEffect(() => {
    if (state?.ok) onOk?.();
  }, [state, onOk]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      {modal ? <input type="hidden" name="modal" value="1" /> : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="login-email" className="text-sm font-medium text-zinc-800">Email</label>
        <input id="login-email" name="email" type="email" required autoComplete="email" className="palacio-input" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="login-password" className="text-sm font-medium text-zinc-800">Contraseña</label>
        <input id="login-password" name="password" type="password" required autoComplete="current-password" className="palacio-input" />
      </div>
      <Mensajes state={state} />
      <button type="submit" disabled={pending} className="palacio-btn-primary px-4 py-2.5 text-sm">
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}

export function FormularioRegistro({ modal = false, next = "", onOk }) {
  const [state, formAction, pending] = useActionState(registrarClienteWeb, {});
  useEffect(() => {
    if (state?.ok) onOk?.();
  }, [state, onOk]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      {modal ? <input type="hidden" name="modal" value="1" /> : null}
      {CAMPOS_REGISTRO.map((c) => (
        <div key={c.name} className="flex flex-col gap-1.5">
          <label htmlFor={`registro-${c.name}`} className="text-sm font-medium text-zinc-800">{c.label}</label>
          <input id={`registro-${c.name}`} name={c.name} type={c.type} required autoComplete={c.autoComplete} className="palacio-input" />
        </div>
      ))}
      <Mensajes state={state} />
      <button type="submit" disabled={pending} className="palacio-btn-primary px-4 py-2.5 text-sm">
        {pending ? "Creando cuenta…" : "Registrarme"}
      </button>
    </form>
  );
}
