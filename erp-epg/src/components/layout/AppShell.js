"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/auth/LogoutButton";

const NAV = [
  {
    section: "INICIO",
    items: [
      {
        href: "/",
        label: "Dashboard",
        icon: HomeIcon,
        match: (p) => p === "/",
      },
    ],
  },
  {
    section: "INVENTARIO",
    items: [
      {
        href: "/inventario/productos",
        label: "Productos",
        icon: BoxIcon,
        match: (p) => p.startsWith("/inventario/productos"),
      },
      {
        href: "/inventario/marcas",
        label: "Marcas",
        icon: TagIcon,
        match: (p) => p.startsWith("/inventario/marcas"),
      },
      {
        label: "Stock",
        icon: ChartIcon,
        match: (p) => p.startsWith("/inventario/stock"),
        children: [
          { href: "/inventario/stock", label: "General" },
          { href: "/inventario/stock/lotes", label: "Lotes" },
        ],
      },
      {
        label: "Movimientos",
        icon: ArrowsIcon,
        match: (p) => p.startsWith("/inventario/movimientos"),
        children: [
          { href: "/inventario/movimientos", label: "Historial" },
          { href: "/inventario/movimientos/nuevo", label: "Registrar movimiento" },
          { href: "/inventario/movimientos/tipos", label: "Tipos de movimiento" },
        ],
      },
      {
        href: "/inventario/depositos",
        label: "Depósitos",
        icon: WarehouseIcon,
        match: (p) => p.startsWith("/inventario/depositos"),
      },
    ],
  },
  {
    section: "CATÁLOGO",
    items: [
      {
        href: "/catalogo/unidades-medida",
        label: "Unidades de medida",
        icon: RulerIcon,
        match: (p) => p.startsWith("/catalogo/unidades-medida"),
      },
      {
        href: "/catalogo/rubros",
        label: "Rubros",
        icon: FolderIcon,
        match: (p) => p.startsWith("/catalogo/rubros"),
      },
      {
        href: "/catalogo/categorias",
        label: "Categorías",
        icon: ListIcon,
        match: (p) => p.startsWith("/catalogo/categorias"),
      },
    ],
  },
];

/**
 * @param {{ user?: { nombre?: string, apellido?: string, rol?: string } | null, children: import('react').ReactNode }} props
 */
export function AppShell({ user, children }) {
  const pathname = usePathname();

  const nombreCompleto = user
    ? [user.nombre, user.apellido].filter(Boolean).join(" ")
    : "Usuario";
  const iniciales =
    [user?.nombre, user?.apellido]
      .filter(Boolean)
      .map((parte) => parte[0]?.toUpperCase())
      .join("") || "U";

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between bg-palacio-red px-4 text-white shadow-sm md:px-6">
        <Link href="/" className="flex items-center gap-3">
          <div
            className="flex size-9 items-center justify-center rounded-full bg-white/15 text-sm font-bold"
            aria-hidden
          >
            P
          </div>
          <div className="leading-tight">
            <p className="text-base font-semibold tracking-tight">
              Palacio · ERP
            </p>
            <p className="text-[10px] font-medium tracking-[0.12em] text-white/75 uppercase">
              Gestión & punto de venta
            </p>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium leading-tight">{nombreCompleto}</p>
            <p className="text-[11px] text-white/70">
              {user?.rol ?? "Sesión iniciada"}
            </p>
          </div>
          <div className="flex size-8 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
            {iniciales}
          </div>
          <LogoutButton className="rounded-full border border-white/25 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/15 disabled:opacity-60" />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-56 shrink-0 border-r border-palacio-border bg-white md:flex md:flex-col">
          <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-5">
            {NAV.map((group) => (
              <div key={group.section}>
                <p className="mb-2 px-2 text-[10px] font-semibold tracking-[0.14em] text-palacio-muted">
                  {group.section}
                </p>
                <ul className="flex flex-col gap-0.5">
                  {group.items.map((item) => (
                    <NavItem key={item.label} item={item} pathname={pathname} />
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 overflow-auto bg-palacio-bg">
          {children}
        </main>
      </div>
    </div>
  );
}

function NavItem({ item, pathname }) {
  const active = item.match(pathname);
  const [open, setOpen] = useState(active);

  if (item.children) {
    return (
      <li>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className={[
            "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition",
            active
              ? "bg-palacio-red-soft font-semibold text-palacio-red"
              : "text-zinc-700 hover:bg-zinc-50",
          ].join(" ")}
        >
          <item.icon className={active ? "text-palacio-red" : "text-zinc-500"} />
          <span className="flex-1 truncate text-left">{item.label}</span>
          <ChevronIcon
            className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
          />
        </button>
        {open ? (
          <ul className="mt-0.5 mb-1 flex flex-col gap-0.5 border-l border-palacio-border pl-4">
            {item.children.map((child) => {
              // Prefijo más largo gana: evita que "General" (/stock) quede
              // activo también en /stock/lotes, igual que en Movimientos.
              const childActive =
                item.children
                  .filter(
                    (c) =>
                      pathname === c.href || pathname.startsWith(`${c.href}/`)
                  )
                  .sort((a, b) => b.href.length - a.href.length)[0]?.href ===
                child.href;
              return (
                <li key={child.href}>
                  <Link
                    href={child.href}
                    className={[
                      "block rounded-lg px-2.5 py-1.5 text-sm transition",
                      childActive
                        ? "font-semibold text-palacio-red"
                        : "text-zinc-600 hover:bg-zinc-50",
                    ].join(" ")}
                  >
                    {child.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
      </li>
    );
  }

  return (
    <li>
      <Link
        href={item.href}
        className={[
          "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition",
          active
            ? "bg-palacio-red-soft font-semibold text-palacio-red"
            : "text-zinc-700 hover:bg-zinc-50",
        ].join(" ")}
      >
        <item.icon className={active ? "text-palacio-red" : "text-zinc-500"} />
        <span className="flex-1 truncate text-left">{item.label}</span>
      </Link>
    </li>
  );
}

function iconProps(className) {
  return {
    className: `size-4 shrink-0 ${className ?? ""}`,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    viewBox: "0 0 24 24",
    "aria-hidden": true,
  };
}

function HomeIcon({ className }) {
  return (
    <svg {...iconProps(className)}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 11.5 12 4l9 7.5M5 10v10h14V10M9.5 20v-6h5v6"
      />
    </svg>
  );
}

function BoxIcon({ className }) {
  return (
    <svg {...iconProps(className)}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 8 12 3 3 8m18 0-9 5m9-5v9l-9 5m0-14L3 8m9 5v9m0-9L3 8m0 0v9l9 5"
      />
    </svg>
  );
}

function TagIcon({ className }) {
  return (
    <svg {...iconProps(className)}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.5 12.5 12.5 20.5a2 2 0 0 1-2.83 0l-6.17-6.17a2 2 0 0 1 0-2.83L11.5 3.5H19a1.5 1.5 0 0 1 1.5 1.5v7.5Z"
      />
      <circle cx="15.5" cy="8.5" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ChartIcon({ className }) {
  return (
    <svg {...iconProps(className)}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 20V10m6.5 10V4m6.5 16v-7"
      />
    </svg>
  );
}

function ArrowsIcon({ className }) {
  return (
    <svg {...iconProps(className)}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 7h11m0 0-4-4m4 4-4 4M17 17H6m0 0 4 4m-4-4 4-4"
      />
    </svg>
  );
}

function WarehouseIcon({ className }) {
  return (
    <svg {...iconProps(className)}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6"
      />
    </svg>
  );
}

function RulerIcon({ className }) {
  return (
    <svg {...iconProps(className)}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 15 15 4l5 5L9 20 4 15Zm3-3 2 2m2-6 2 2m2-6 2 2"
      />
    </svg>
  );
}

function FolderIcon({ className }) {
  return (
    <svg {...iconProps(className)}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Z"
      />
    </svg>
  );
}

function ListIcon({ className }) {
  return (
    <svg {...iconProps(className)}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
      />
    </svg>
  );
}

function ChevronIcon({ className }) {
  return (
    <svg {...iconProps(className)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 6 6 6-6 6" />
    </svg>
  );
}
