"use client";

import { useEffect } from "react";

/** Dispara el diálogo de impresión del navegador al montarse. */
export function AutoImprimir() {
  useEffect(() => {
    window.print();
  }, []);

  return null;
}
