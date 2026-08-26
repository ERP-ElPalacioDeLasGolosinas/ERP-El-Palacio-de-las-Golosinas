"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONOS = {
  tag: (
    <path d="M20 12l-8 8-9-9V4h7l10 8zM7.5 7.5h.01" strokeLinecap="round" strokeLinejoin="round" />
  ),
  box: (
    <path d="M3 7l9-4 9 4-9 4-9-4zm0 0v10l9 4 9-4V7" strokeLinecap="round" strokeLinejoin="round" />
  ),
  ruler: (
    <path d="M3 17L17 3l4 4L7 21l-4-4zm5-1l2 2m1-5l2 2m1-5l2 2" strokeLinecap="round" strokeLinejoin="round" />
  ),
  layers: (
    <path d="M12 3l9 5-9 5-9-5 9-5zm-9 9l9 5 9-5m-18 4l9 5 9-5" strokeLinecap="round" strokeLinejoin="round" />
  ),
  swap: (
    <path d="M7 4v13m0 0l-3-3m3 3l3-3m7 6V7m0 0l-3 3m3-3l3 3" strokeLinecap="round" strokeLinejoin="round" />
  ),
};

const SECCIONES = [
  {
    titulo: "Operación",
    items: [
      { label: "Marcas", href: "/marcas", icon: "tag" },
      { label: "Depósitos", icon: "box" },
      { label: "Unidades de medida", icon: "ruler" },
      { label: "Rubros", icon: "layers" },
      { label: "Tipos de movimiento", icon: "swap" },
    ],
  },
];

function Icono({ nombre, className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className={className}
      aria-hidden="true"
    >
      {ICONOS[nombre]}
    </svg>
  );
}

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex flex-col bg-panel border-r border-linea px-3 py-4">
      {SECCIONES.map((seccion, i) => (
        <div key={seccion.titulo}>
          {i > 0 && <div className="mx-2 my-3.5 h-px bg-linea" />}
          <div className="px-3 pb-2 pt-1.5 text-[10.5px] font-bold uppercase tracking-[1.4px] text-tinta-suave">
            {seccion.titulo}
          </div>
          <nav className="flex flex-col gap-0.5">
            {seccion.items.map((item) => {
              const activo = item.href && pathname.startsWith(item.href);

              if (!item.href) {
                return (
                  <span
                    key={item.label}
                    className="flex cursor-not-allowed items-center gap-2.5 rounded-[9px] px-3 py-2.5 text-[13.5px] font-medium text-tinta-suave/60"
                    title="Próximamente"
                  >
                    <Icono nombre={item.icon} className="h-5 w-5 shrink-0 text-linea" />
                    {item.label}
                  </span>
                );
              }

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-current={activo ? "page" : undefined}
                  className={`relative flex items-center gap-2.5 rounded-[9px] px-3 py-2.5 text-[13.5px] ${
                    activo
                      ? "bg-gradient-to-r from-rosado to-panel font-bold text-rojo-hondo before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3.5px] before:rounded-r before:bg-rojo"
                      : "font-medium text-tinta hover:bg-rosado/60"
                  }`}
                >
                  <Icono
                    nombre={item.icon}
                    className={`h-5 w-5 shrink-0 ${activo ? "text-rojo" : "text-tinta-suave"}`}
                  />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      ))}
    </aside>
  );
}
