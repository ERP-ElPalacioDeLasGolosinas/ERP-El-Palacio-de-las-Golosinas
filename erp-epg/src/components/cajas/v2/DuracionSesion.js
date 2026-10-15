"use client";

import { useEffect, useState } from "react";

/** @param {number} ms */
function formatear(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Tiempo transcurrido desde `desde`, actualizado cada segundo.
 *
 * @param {{ desde: string | null | undefined }} props
 */
export function DuracionSesion({ desde }) {
  const [ahora, setAhora] = useState(null);

  useEffect(() => {
    const tick = () => setAhora(Date.now());
    const primero = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(primero);
      clearInterval(id);
    };
  }, []);

  const inicio = desde ? new Date(desde).getTime() : NaN;
  if (Number.isNaN(inicio)) return <span>—</span>;
  // Antes de montar no hay reloj: evita diferencias entre servidor y cliente.
  if (ahora == null) return <span className="tabular-nums">--:--:--</span>;
  return <span className="tabular-nums">{formatear(ahora - inicio)}</span>;
}
