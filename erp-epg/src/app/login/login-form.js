"use client";

import { useActionState } from "react";
import { iniciarSesion } from "./actions";

const initialState = { error: null };

export default function LoginForm() {
  const [state, action, pending] = useActionState(iniciarSesion, initialState);

  return (
    <form action={action} className="palacio-card flex w-full max-w-sm flex-col gap-4 p-5 md:p-6">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-zinc-800">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="palacio-input"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-zinc-800">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="palacio-input"
        />
      </div>

      {state?.error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="palacio-btn-primary px-4 py-2.5 text-sm"
      >
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
