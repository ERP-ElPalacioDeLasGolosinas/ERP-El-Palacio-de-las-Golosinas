"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { agregarAlCarrito } from "@/app/(tienda)/tienda/carrito/actions";
import { useTienda } from "./TiendaProvider";
import { FormularioLogin, FormularioRegistro } from "./AuthForms";

const PESTANAS = [
  { id: "login", label: "Ingresar" },
  { id: "registro", label: "Crear cuenta" },
];

export default function AuthModal() {
  const router = useRouter();
  const { modal, cerrarModal, cambiarPestana, abrirDrawer } = useTienda();
  const { abierto, pestana, next, pendiente } = modal;

  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e) => e.key === "Escape" && cerrarModal();
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierto, cerrarModal]);

  const alIngresar = useCallback(async () => {
    cerrarModal();
    if (pendiente) {
      const fd = new FormData();
      fd.set("id_producto", pendiente.id_producto);
      fd.set("cantidad", String(pendiente.cantidad));
      await agregarAlCarrito(fd);
      abrirDrawer();
    }
    if (next) router.push(`/tienda${next}`);
    router.refresh();
  }, [cerrarModal, abrirDrawer, pendiente, next, router]);

  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => e.target === e.currentTarget && cerrarModal()}
    >
      <div role="dialog" aria-modal="true" aria-label="Acceso a la tienda" className="palacio-card w-full max-w-sm p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex gap-1 rounded-lg bg-zinc-100 p-1" role="tablist">
            {PESTANAS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={pestana === p.id}
                onClick={() => cambiarPestana(p.id)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  pestana === p.id ? "bg-white text-zinc-900 shadow-sm" : "text-palacio-muted"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={cerrarModal} aria-label="Cerrar" className="text-xl leading-none text-palacio-muted">
            ×
          </button>
        </div>
        {pestana === "login" ? (
          <FormularioLogin key="login" modal next={next ?? ""} onOk={alIngresar} />
        ) : (
          <FormularioRegistro key="registro" modal next={next ?? ""} onOk={alIngresar} />
        )}
      </div>
    </div>
  );
}
