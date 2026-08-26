"use client";

import { useEffect } from "react";

export default function ErrorMarcas({ error, retry }) {
  useEffect(() => {
    // Detalle técnico a consola (en prod el message llega redactado por Next;
    // el digest permite correlacionar con los logs del server).
    console.error("Error cargando /marcas:", error);
  }, [error]);

  return (
    <div className="mx-auto mt-10 max-w-md">
      <div className="card p-6 text-center">
        <h2 className="font-baloo text-lg font-bold text-rojo-hondo">
          No se pudieron cargar las marcas
        </h2>
        <p className="mb-4 mt-1 text-sm text-tinta-suave">
          Hubo un problema al consultar la base de datos. Puede ser temporal:
          probá de nuevo en unos segundos.
        </p>
        <button type="button" className="btn-primary" onClick={() => retry()}>
          Reintentar
        </button>
        {error?.digest && (
          <p className="mt-3 text-[11px] text-tinta-suave/70">
            Código de referencia: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
