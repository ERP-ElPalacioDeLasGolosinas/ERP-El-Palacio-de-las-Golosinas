"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/tienda/cuenta", label: "Resumen", exacto: true },
  { href: "/tienda/cuenta/pedidos", label: "Pedidos" },
  { href: "/tienda/cuenta/datos", label: "Datos" },
  { href: "/tienda/cuenta/soporte", label: "Soporte" },
];

export default function CuentaNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Mi cuenta" className="flex gap-1 overflow-x-auto border-b border-palacio-border">
      {ITEMS.map(({ href, label, exacto }) => {
        const activo = exacto ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={activo ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${
              activo
                ? "border-palacio-red text-palacio-red"
                : "border-transparent text-palacio-muted hover:text-palacio-red"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
