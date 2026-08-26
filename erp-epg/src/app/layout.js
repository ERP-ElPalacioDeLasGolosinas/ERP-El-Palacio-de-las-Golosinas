import { Baloo_2, Inter } from "next/font/google";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { cerrarSesion } from "./auth-actions";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const baloo = Baloo_2({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
  variable: "--font-baloo-2",
});

export const metadata = {
  title: "ERP — El Palacio de las Golosinas",
  description: "Sistema de gestión de El Palacio de las Golosinas",
};

export default async function RootLayout({ children }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html
      lang="es"
      className={`${inter.variable} ${baloo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans text-tinta bg-crema">
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
