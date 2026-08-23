"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  {
    section: "OPERACIÓN",
    items: [
      {
        href: "/depositos",
        label: "Depósitos",
        icon: WarehouseIcon,
        match: (p) => p === "/" || p.startsWith("/depositos"),
      },
    ],
  },
];

export function AppShell({ children }) {
  const pathname = usePathname();

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
          <div className="flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">Usuario</p>
              <p className="text-[11px] text-white/70">Sesión local</p>
            </div>
            <div className="flex size-8 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
              U
            </div>
          </div>
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
