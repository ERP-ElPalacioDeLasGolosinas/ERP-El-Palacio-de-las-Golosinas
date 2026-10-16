"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  cambiarCantidad,
  obtenerResumenCarrito,
  quitarDelCarrito,
} from "@/app/(tienda)/tienda/carrito/actions";
import { useTienda } from "./TiendaProvider";

const precioFmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

const AVISOS = {
  stock_insuficiente: "No hay stock suficiente para esa cantidad.",
  agotado: "Agotado.",
  no_disponible: "Ya no está disponible.",
};

export default function CarritoDrawer() {
  const { drawerAbierto, cerrarDrawer, abrirLogin } = useTienda();
  const [resumen, setResumen] = useState(null);
  const [ocupado, empezar] = useTransition();

  const cargar = useCallback(async () => {
    const res = await obtenerResumenCarrito();
    if (res?.requiereLogin) {
      cerrarDrawer();
      abrirLogin({ next: "/carrito" });
      return;
    }
    setResumen(res);
  }, [cerrarDrawer, abrirLogin]);

  useEffect(() => {
    if (!drawerAbierto) return;
    let vigente = true;
    obtenerResumenCarrito().then((res) => {
      if (!vigente) return;
      if (res?.requiereLogin) {
        cerrarDrawer();
        abrirLogin({ next: "/carrito" });
      } else setResumen(res);
    });
    const alTeclear = (e) => e.key === "Escape" && cerrarDrawer();
    window.addEventListener("keydown", alTeclear);
    return () => {
      vigente = false;
      window.removeEventListener("keydown", alTeclear);
      setResumen(null);
    };
  }, [drawerAbierto, cerrarDrawer, abrirLogin]);

  const enviar = (accion, id, cantidad) =>
    empezar(async () => {
      const fd = new FormData();
      fd.set("id_producto", id);
      if (cantidad !== undefined) fd.set("cantidad", String(cantidad));
      await accion(fd);
      await cargar();
    });

  if (!drawerAbierto) return null;

  const filas = resumen?.filas ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      onClick={(e) => e.target === e.currentTarget && cerrarDrawer()}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Carrito"
        className="flex h-full w-full max-w-sm flex-col bg-white shadow-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 p-4">
          <h2 className="text-lg font-bold">Tu carrito</h2>
          <button type="button" onClick={cerrarDrawer} aria-label="Cerrar" className="text-xl leading-none text-palacio-muted">
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!resumen ? (
            <p className="text-palacio-muted">Cargando…</p>
          ) : resumen.error ? (
            <p className="text-palacio-muted">No se pudo cargar el carrito. Probá de nuevo en un rato.</p>
          ) : filas.length === 0 ? (
            <p className="text-palacio-muted">El carrito está vacío.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {filas.map((l) => (
                <li key={l.id_producto} className="palacio-card flex flex-col gap-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs text-palacio-muted">{l.nombre_marca}</span>
                      <p className="font-semibold leading-tight">{l.nombre_producto}</p>
                      <span className="text-sm text-palacio-muted">{l.presentacion}</span>
                    </div>
                    {l.estado !== "no_disponible" ? (
                      <span className="whitespace-nowrap font-bold">{precioFmt.format(l.precio)}</span>
                    ) : null}
                  </div>
                  {l.estado !== "ok" ? (
                    <p className="text-sm font-medium text-red-700">
                      {AVISOS[l.estado]}
                      {l.estado === "stock_insuficiente" ? ` Disponibles: ${Number(l.stock_disponible)}.` : ""}
                    </p>
                  ) : null}
                  <div className="flex items-center gap-2">
                    {l.estado !== "no_disponible" ? (
                      <input
                        type="number"
                        min="1"
                        max="9999"
                        defaultValue={Number(l.cantidad_solicitada)}
                        disabled={ocupado}
                        aria-label={`Cantidad de ${l.nombre_producto}`}
                        className="palacio-input w-20"
                        onBlur={(e) => {
                          const n = parseInt(e.target.value, 10);
                          if (n >= 1 && n !== Number(l.cantidad_solicitada)) enviar(cambiarCantidad, l.id_producto, n);
                        }}
                      />
                    ) : null}
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => enviar(quitarDelCarrito, l.id_producto)}
                      className="palacio-btn-secondary px-3 py-2 text-sm"
                    >
                      Quitar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-zinc-200 p-4">
          {filas.length > 0 && !resumen?.error ? (
            <p className="text-right text-lg font-bold">Total: {precioFmt.format(resumen.total)}</p>
          ) : null}
          <div className="flex gap-2">
            <button type="button" onClick={cerrarDrawer} className="palacio-btn-secondary flex-1 px-3 py-2 text-sm">
              Seguir comprando
            </button>
            <Link href="/tienda/carrito" onClick={cerrarDrawer} className="palacio-btn-primary flex-1 px-3 py-2 text-center text-sm">
              Ver carrito
            </Link>
          </div>
        </div>
      </aside>
    </div>
  );
}
