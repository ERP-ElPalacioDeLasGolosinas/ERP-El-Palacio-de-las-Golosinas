"use client";

import { useTienda } from "./TiendaProvider";

export default function AccesoBotones() {
  const { abrirLogin, abrirRegistro } = useTienda();
  return (
    <>
      <button type="button" onClick={() => abrirLogin()} className="hover:text-palacio-red">
        Ingresar
      </button>
      <button
        type="button"
        onClick={() => abrirRegistro()}
        className="rounded-full border border-palacio-red px-4 py-1.5 text-palacio-red transition hover:bg-palacio-red-soft"
      >
        Registrarme
      </button>
    </>
  );
}
