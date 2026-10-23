import Link from "next/link";

export default function NotificacionesBoton({ noLeidas = 0 }) {
  const n = Number(noLeidas) || 0;
  return (
    <Link
      href="/tienda/cuenta/notificaciones"
      aria-label={n > 0 ? `Notificaciones (${n} sin leer)` : "Notificaciones"}
      className="relative hover:text-palacio-red"
    >
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
      {n > 0 && (
        <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-palacio-red px-1 text-[10px] font-bold leading-none text-white">
          {n > 9 ? "9+" : n}
        </span>
      )}
    </Link>
  );
}
