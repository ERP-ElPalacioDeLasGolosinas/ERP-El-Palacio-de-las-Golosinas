"use client";

import Link from "next/link";
import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { registrarClienteWeb } from "./actions";

const CAMPOS = [
  { name: "nombre", label: "Nombre y apellido", type: "text", autoComplete: "name", required: true },
  { name: "documento", label: "DNI o CUIT (XX-XXXXXXXX-X)", type: "text", autoComplete: "off", required: true },
  { name: "telefono", label: "Teléfono (solo números)", type: "tel", autoComplete: "tel", required: true },
  { name: "direccion", label: "Dirección (opcional)", type: "text", autoComplete: "street-address", required: false },
  { name: "email", label: "Email", type: "email", autoComplete: "email", required: true },
  { name: "password", label: "Contraseña (mínimo 8 caracteres)", type: "password", autoComplete: "new-password", required: true },
];

function Formulario() {
  const next = useSearchParams().get("next") === "/checkout" ? "/checkout" : "";
  const sufijo = next ? `?next=${next}` : "";
  const [state, formAction, pending] = useActionState(registrarClienteWeb, {});

  return (
    <main className="flex min-h-dvh items-center justify-center bg-palacio-bg p-6">
      <div className="palacio-card w-full max-w-md p-7 md:p-8">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900">Crear cuenta</h1>
        <form action={formAction} className="mt-5 flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />
          {CAMPOS.map((c) => (
            <div key={c.name} className="flex flex-col gap-1.5">
              <label htmlFor={c.name} className="text-sm font-medium text-zinc-800">{c.label}</label>
              <input id={c.name} name={c.name} type={c.type} required={c.required} autoComplete={c.autoComplete} className="palacio-input" />
            </div>
          ))}
          {state?.error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
          ) : null}
          {state?.aviso ? (
            <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{state.aviso}</p>
          ) : null}
          <button type="submit" disabled={pending} className="palacio-btn-primary px-4 py-2.5 text-sm">
            {pending ? "Creando cuenta…" : "Registrarme"}
          </button>
        </form>
        <p className="mt-4 text-sm text-palacio-muted">
          ¿Ya tenés cuenta? <Link href={`/login${sufijo}`} className="font-medium text-palacio-red">Ingresá</Link>
        </p>
      </div>
    </main>
  );
}

export default function RegistroTienda() {
  return (
    <Suspense>
      <Formulario />
    </Suspense>
  );
}
