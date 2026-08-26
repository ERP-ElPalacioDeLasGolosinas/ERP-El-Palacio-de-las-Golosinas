"use client";

import { useActionState } from "react";
import { login } from "./actions";

const initialState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-palacio-bg">
      <header className="flex h-14 items-center gap-3 bg-palacio-red px-4 text-white shadow-sm md:px-6">
        <div
          className="flex size-9 items-center justify-center rounded-full bg-white/15 text-sm font-bold"
          aria-hidden
        >
          P
        </div>
        <div className="leading-tight">
          <p className="text-base font-semibold tracking-tight">Palacio · ERP</p>
          <p className="text-[10px] font-medium tracking-[0.12em] text-white/75 uppercase">
            Gestión & punto de venta
          </p>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="palacio-card w-full max-w-md p-7 md:p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-palacio-red text-xl font-bold text-white">
              P
            </div>
            <h1 className="mt-4 text-xl font-bold tracking-tight text-zinc-900">
              El Palacio de las Golosinas
            </h1>
            <p className="mt-1 text-sm text-palacio-muted">
              Ingresá con tu cuenta para continuar
            </p>
          </div>

          <form action={formAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium text-zinc-800">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="palacio-input"
                placeholder="tu@email.com"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-sm font-medium text-zinc-800"
              >
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="palacio-input"
                placeholder="••••••••"
              />
            </div>

            {state?.error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {state.error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={pending}
              className="palacio-btn-primary mt-1 px-4 py-2.5 text-sm"
            >
              {pending ? "Iniciando sesión…" : "Iniciar sesión"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
