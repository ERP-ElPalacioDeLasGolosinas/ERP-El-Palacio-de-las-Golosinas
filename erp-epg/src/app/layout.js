import "./globals.css";
import { InactivityProvider } from "@/components/auth/InactivityProvider";

export const metadata = {
  title: "Palacio · ERP",
  description: "Gestión & punto de venta — El Palacio de las Golosinas",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">
        <InactivityProvider>{children}</InactivityProvider>
      </body>
    </html>
  );
}
