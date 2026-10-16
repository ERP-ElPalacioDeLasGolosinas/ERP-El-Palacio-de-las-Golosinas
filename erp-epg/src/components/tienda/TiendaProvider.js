"use client";

import { createContext, Suspense, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import AuthModal from "./AuthModal";
import CarritoDrawer from "./CarritoDrawer";

const TiendaContext =createContext(null);

// Destinos a los que se puede volver tras ingresar (evita redirecciones abiertas).
const DESTINOS_PERMITIDOS = ["/checkout", "/carrito"];

export function destinoSeguro(next) {
  return DESTINOS_PERMITIDOS.includes(next) ? next : null;
}

// Lee ?login=1&next= y abre el modal; limpia los parámetros de la URL.
function LeerParametrosModal({ abrirLogin }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const pedirLogin = params.get("login") === "1";
  const next = params.get("next");

  useEffect(() => {
    if (!pedirLogin) return;
    abrirLogin({ next: destinoSeguro(next) });
    const resto = new URLSearchParams(params);
    resto.delete("login");
    resto.delete("next");
    const qs = resto.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pedirLogin, next, params, pathname, router, abrirLogin]);

  return null;
}

export default function TiendaProvider({ cliente, children }) {
  const [modal, setModal] = useState({ abierto: false, pestana: "login", next: null, pendiente: null });
  const [drawerAbierto, setDrawerAbierto] = useState(false);

  // `pendiente` = { id_producto, cantidad } a agregar al carrito una vez que ingrese.
  const abrirLogin = useCallback(
    ({ next = null, pendiente = null } = {}) => setModal({ abierto: true, pestana: "login", next, pendiente }),
    []
  );
  const abrirRegistro = useCallback(
    ({ next = null, pendiente = null } = {}) => setModal({ abierto: true, pestana: "registro", next, pendiente }),
    []
  );
  const cerrarModal = useCallback(() => setModal((m) => ({ ...m, abierto: false })), []);
  const cambiarPestana = useCallback((pestana) => setModal((m) => ({ ...m, pestana })), []);
  const abrirDrawer = useCallback(() => setDrawerAbierto(true), []);
  const cerrarDrawer = useCallback(() => setDrawerAbierto(false), []);

  const valor = useMemo(
    () => ({
      cliente,
      modal,
      abrirLogin,
      abrirRegistro,
      cerrarModal,
      cambiarPestana,
      drawerAbierto,
      abrirDrawer,
      cerrarDrawer,
    }),
    [cliente, modal, abrirLogin, abrirRegistro, cerrarModal, cambiarPestana, drawerAbierto, abrirDrawer, cerrarDrawer]
  );

  return (
    <TiendaContext.Provider value={valor}>
      <Suspense fallback={null}>
        <LeerParametrosModal abrirLogin={abrirLogin} />
      </Suspense>
      {children}
      <AuthModal />
      <CarritoDrawer />
    </TiendaContext.Provider>
  );
}

export function useTienda() {
  const ctx = useContext(TiendaContext);
  if (!ctx) throw new Error("useTienda debe usarse dentro de <TiendaProvider>.");
  return ctx;
}
