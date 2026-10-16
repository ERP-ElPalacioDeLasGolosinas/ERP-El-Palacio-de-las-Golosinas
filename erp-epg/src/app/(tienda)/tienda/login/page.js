"use client";

import Link from "next/link";
import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { loginTienda } from "./actions";

function Formulario() {
  const next = useSearchParams().get("next") === "/checkout" ? "/checkout" : "";
  const sufijo = next ? `?next=${next}` : "";
  const [state, formAction, pending] = useActionState(loginTienda, { error: null });

  return (
    <main className="flex min-h-dvh items-center justify-center bg-palacio-bg p-6">
      <div className="palacio-card w-full max-w-md p-7 md:p-8">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900">Ingresar a la tienda</h1>
        <form action={formAction} className="mt-5 flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-zinc-800">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email" className="palacio-input" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-zinc-800">Contraseña</label>
            <input id="password" name="password" type="password" required autoComplete="current-password" className="palacio-input" />
          </div>
          {state?.error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
          ) : null}
          <button type="submit" disabled={pending} className="palacio-btn-primary px-4 py-2.5 text-sm">
            {pending ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
        <p className="mt-4 text-sm text-palacio-muted">
          ¿No tenés cuenta? <Link href={`/registro${sufijo}`} className="font-medium text-palacio-red">Registrate</Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginTienda() {
  return (
    <Suspense>
      <Formulario />
    </Suspense>
  );
}
