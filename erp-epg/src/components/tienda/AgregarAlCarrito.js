"use client";

import { useState, useTransition } from "react";
import { agregarAlCarrito } from "@/app/(tienda)/tienda/carrito/actions";
import { useTienda } from "./TiendaProvider";

export default function AgregarAlCarrito({ idProducto, conCantidad = false }) {
  const { cliente, abrirLogin, abrirDrawer } = useTienda();
  const [cantidad, setCantidad] = useState("1");
  const [pendiente, empezar] = useTransition();

  const alEnviar = (e) => {
    e.preventDefault();
    const n = Math.max(1, Math.min(9999, parseInt(cantidad, 10) || 1));
    const item = { id_producto: idProducto, cantidad: n };
    if (!cliente) {
      abrirLogin({ pendiente: item });
      return;
    }
    empezar(async () => {
      const fd = new FormData();
      fd.set("id_producto", item.id_producto);
      fd.set("cantidad", String(item.cantidad));
      const res = await agregarAlCarrito(fd);
      if (res?.requiereLogin) abrirLogin({ pendiente: item });
      else abrirDrawer();
    });
  };

  return (
    <form onSubmit={alEnviar} className="mt-2 flex items-center gap-2">
      {conCantidad && (
        <input
          type="number"
          min="1"
          max="9999"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          aria-label="Cantidad"
          className="palacio-input w-24"
        />
      )}
      <button type="submit" disabled={pendiente} className="palacio-btn-primary px-4 py-2 text-sm">
        {pendiente ? "Agregando…" : "Agregar al carrito"}
      </button>
    </form>
  );
}
