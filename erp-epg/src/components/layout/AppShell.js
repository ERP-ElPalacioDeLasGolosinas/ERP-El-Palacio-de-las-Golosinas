"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cerrarSesion } from "@/app/auth-actions";

const NAV = [
  {
    section: "OPERACIÓN",
    items: [
      { href: "/", label: "Inicio", icon: HomeIcon, match: (p) => p === "/" },
      {
        href: "/depositos",
        label: "Depósitos",
        icon: WarehouseIcon,
        match: (p) => p.startsWith("/depositos"),
        disabled: true,
      },
      {
        href: "/rubros",
        label: "Rubros",
        icon: BoxIcon,
        match: (p) => p.startsWith("/rubros"),
        done: true,
      },
      {
        href: "/categorias",
        label: "Categorías",
        icon: TagsIcon,
        match: (p) => p.startsWith("/categorias"),
        done: true,
      },
      {
        href: "#",
        label: "Stock",
        icon: LayersIcon,
        match: () => false,
        disabled: true,
      },
    ],
  },
  {
    section: "PRÓXIMOS SPRINTS",
    items: [
      {
        href: "#",
        label: "Ventas y caja",
        icon: CartIcon,
        match: () => false,
        disabled: true,
        sprint: "S2",
      },
      {
        href: "#",
        label: "Compras",
        icon: TruckIcon,
        match: () => false,
        disabled: true,
        sprint: "S2",
      },
    ],
  },
];

/**
 * @param {{ children: import('react').ReactNode, userEmail?: string | null }} props
 */
export function AppShell({ children, userEmail = null }) {
  const pathname = usePathname();
  const initial = userEmail ? userEmail.slice(0, 1).toUpperCase() : "U";

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between bg-palacio-red px-4 text-white shadow-sm md:px-6">
        <div className="flex items-center gap-3">
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
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden rounded-full bg-white/15 px-3 py-1 text-xs font-medium sm:inline">
            Sprint 1 · Stock & catálogo
          </span>
          {userEmail ? (
            <div className="flex items-center gap-2">
              <div className="hidden text-right sm:block">
                <p className="max-w-[180px] truncate text-sm font-medium leading-tight">
                  {userEmail}
                </p>
                <form action={cerrarSesion}>
                  <button
                    type="submit"
                    className="text-[11px] text-white/80 underline-offset-2 hover:underline"
                  >
                    Cerrar sesión
                  </button>
                </form>
              </div>
              <div className="flex size-8 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
                {initial}
              </div>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium hover:bg-white/25"
            >
              Iniciar sesión
            </Link>
          )}
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
                  {group.items.map((item) => {
                    const active = item.match(pathname);
                    const Icon = item.icon;
                    const className = [
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition",
                      active
                        ? "bg-palacio-red-soft font-semibold text-palacio-red"
                        : "text-zinc-700 hover:bg-zinc-50",
                      item.disabled ? "cursor-default opacity-55" : "",
                    ].join(" ");

                    const content = (
                      <>
                        <Icon
                          className={
                            active ? "text-palacio-red" : "text-zinc-500"
                          }
                        />
                        <span className="flex-1 truncate text-left">
                          {item.label}
                        </span>
                        {item.sprint ? (
                          <span className="rounded bg-palacio-gold/90 px-1.5 py-0.5 text-[10px] font-bold text-zinc-900">
                            {item.sprint}
                          </span>
                        ) : null}
                        {item.done ? (
                          <span className="text-emerald-600" aria-hidden>
                            ✓
                          </span>
                        ) : null}
                      </>
                    );

                    return (
                      <li key={item.label}>
                        {item.disabled ? (
                          <span className={className}>{content}</span>
                        ) : (
                          <Link href={item.href} className={className}>
                            {content}
                          </Link>
                        )}
                      </li>
                    );
                  })}
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
        d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z"
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

function BoxIcon({ className }) {
  return (
    <svg {...iconProps(className)}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m21 8-9-5-9 5v8l9 5 9-5V8Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9 5 9-5M12 13v8" />
    </svg>
  );
}

function TagsIcon({ className }) {
  return (
    <svg {...iconProps(className)}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.5 12.5 12 4H4v8l8.5 8.5a1.5 1.5 0 0 0 2.1 0l6-6a1.5 1.5 0 0 0 0-2.1Z"
      />
      <circle cx="7.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function LayersIcon({ className }) {
  return (
    <svg {...iconProps(className)}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m12 3 9 5-9 5-9-5 9-5Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="m3 12 9 5 9-5M3 16l9 5 9-5" />
    </svg>
  );
}

function CartIcon({ className }) {
  return (
    <svg {...iconProps(className)}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 3h2l.4 2M7 13h10l3-8H6.4M7 13 5.4 5M7 13l-1.2 4h12.7M10 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm8 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
      />
    </svg>
  );
}

function TruckIcon({ className }) {
  return (
    <svg {...iconProps(className)}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 7h11v10H3V7Zm11 3h4l3 3v4h-7v-7Z"
      />
      <circle cx="7.5" cy="18.5" r="1.5" />
      <circle cx="17.5" cy="18.5" r="1.5" />
    </svg>
  );
}
