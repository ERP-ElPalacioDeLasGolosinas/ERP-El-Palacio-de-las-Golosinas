"use client";

import { useActionState } from "react";
import { login } from "./actions";

const initialState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <form action={formAction} className="w-full max-w-sm flex flex-col gap-4">
        <h1 className="text-xl font-semibold text-center">
          El Palacio de las Golosinas
        </h1>

        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="rounded border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 outline-none focus:border-black/40 dark:focus:border-white/40"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm font-medium">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="rounded border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 outline-none focus:border-black/40 dark:focus:border-white/40"
          />
        </div>

        {state?.error && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded bg-foreground text-background px-3 py-2 font-medium disabled:opacity-60"
        >
          {pending ? "Iniciando sesión..." : "Iniciar sesión"}
        </button>
      </form>
    </div>
  );
}
