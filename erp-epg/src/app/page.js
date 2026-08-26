import Link from "next/link";
import { getUserWithRole } from "@/lib/auth/roles";
import { LogoutButton } from "@/components/auth/LogoutButton";

export default async function Home() {
  const usuario = await getUserWithRole();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">ERP EPG</h1>
      {usuario && (
        <p className="text-sm text-black/60 dark:text-white/60">
          {usuario.nombre} {usuario.apellido} · {usuario.rol}
        </p>
      )}
      <LogoutButton className="mt-4 rounded bg-foreground text-background px-3 py-2 text-sm font-medium" />
    </div>
  );
}
