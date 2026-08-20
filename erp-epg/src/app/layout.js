import { Baloo_2, Inter } from "next/font/google";
import "./globals.css";

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

export default function RootLayout({ children }) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${baloo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans text-tinta bg-crema">
        {children}
      </body>
    </html>
  );
}
