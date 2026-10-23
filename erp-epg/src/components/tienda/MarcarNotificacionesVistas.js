"use client";

import { useEffect } from "react";
import { marcarNotificacionesVistas } from "@/app/(tienda)/tienda/cuenta/actions";

// Al abrir la lista, marca los avisos como vistos y refresca la campana del header.
export default function MarcarNotificacionesVistas() {
  useEffect(() => {
    marcarNotificacionesVistas();
  }, []);
  return null;
}
