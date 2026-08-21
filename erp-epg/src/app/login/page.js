import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LoginForm from "./login-form";

export const metadata = {
  title: "Iniciar sesión | Palacio · ERP",
};

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/rubros");
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          Iniciar sesión
        </h1>
        <p className="mt-1.5 text-sm text-palacio-muted">
          Usá un usuario de Supabase Auth para operar el ERP (rol{" "}
          <code className="rounded bg-zinc-100 px-1">authenticated</code>).
        </p>
      </div>
      <LoginForm />
    </div>
  );
}
