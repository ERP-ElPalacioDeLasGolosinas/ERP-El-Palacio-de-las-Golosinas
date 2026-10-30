"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * Barra para mover una tabla de costado, arriba y abajo.
 * La de arriba queda fija mientras se recorre el listado.
 */
export function DesplazamientoHorizontal({ children, className = "" }) {
  const arribaRef = useRef(null);
  const tablaRef = useRef(null);
  const [ancho, setAncho] = useState(0);
  const [visible, setVisible] = useState(0);

  useLayoutEffect(() => {
    const tabla = tablaRef.current;
    if (!tabla) return;

    const medir = () => {
      const contenido = tabla.firstElementChild;
      const siguienteAncho = contenido ? contenido.scrollWidth : 0;
      const siguienteVisible = tabla.clientWidth;
      setAncho((prev) => (prev === siguienteAncho ? prev : siguienteAncho));
      setVisible((prev) => (prev === siguienteVisible ? prev : siguienteVisible));
    };

    medir();
    const observer = new ResizeObserver(medir);
    observer.observe(tabla);
    if (tabla.firstElementChild) observer.observe(tabla.firstElementChild);
    return () => observer.disconnect();
  }, [children]);

  function sincronizar(origen, destino) {
    if (!origen || !destino || destino.scrollLeft === origen.scrollLeft) return;
    destino.scrollLeft = origen.scrollLeft;
  }

  const desborda = ancho > visible + 1;

  return (
    <div className={className}>
      <div
        ref={arribaRef}
        onScroll={() => sincronizar(arribaRef.current, tablaRef.current)}
        aria-hidden="true"
        className={
          desborda
            ? "sticky top-0 z-20 overflow-x-auto overflow-y-hidden border-b border-palacio-border bg-white"
            : "hidden"
        }
      >
        <div style={{ width: ancho, height: 1 }} />
      </div>
      <div
        ref={tablaRef}
        onScroll={() => sincronizar(tablaRef.current, arribaRef.current)}
        className="overflow-x-auto"
      >
        {children}
      </div>
    </div>
  );
}
