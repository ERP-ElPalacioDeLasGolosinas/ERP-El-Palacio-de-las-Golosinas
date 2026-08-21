import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { cerrarSesion } from "./auth-actions";

export const metadata = {
  title: "ERP EPG",
  description: "ERP EPG",
};

export default async function RootLayout({ children }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {user && (
          <header className="flex items-center justify-end gap-3 border-b border-black/10 px-4 py-2 text-sm dark:border-white/15">
            <span className="text-black/70 dark:text-white/70">{user.email}</span>
            <form action={cerrarSesion}>
              <button type="submit" className="underline underline-offset-2">
                Cerrar sesión
              </button>
            </form>
          </header>
        )}
        {children}
      </body>
    </html>
  );
}
