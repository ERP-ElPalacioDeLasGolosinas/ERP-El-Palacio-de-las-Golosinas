"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cambiarEstadoPedidoWeb } from "@/lib/pedidos-web/actions";
import { mensajeErrorPedidoWeb } from "@/lib/pedidos-web/errores";

/** Horas desde que quedó en la etapa a partir de las cuales la tarjeta se marca como demorada. */
const UMBRAL_ALERTA_HORAS = 24;

const COLUMNAS = [
  {
    clave: "por_preparar",
    titulo: "Por preparar",
    vacio: "Nada por preparar.",
  },
  { clave: "preparando", titulo: "Preparando", vacio: "Nada en preparación." },
  {
    clave: "listos",
    titulo: "Listos para retirar",
    vacio: "Ningún pedido listo.",
  },
  {
    clave: "despachar",
    titulo: "Para despachar",
    vacio: "Ningún envío por despachar.",
  },
];

/**
 * Etapa del tablero según estado y tipo de entrega; null si el pedido no es parte de la cola.
 *
 * @param {Record<string, any>} p
 */
function etapaDe(p) {
  if (p.estado === "Pagado") return "por_preparar";
  if (p.estado === "En preparación") {
    return p.tipo_entrega === "Envío a domicilio" ? "despachar" : "preparando";
  }
  if (p.estado === "Listo para retirar") return "listos";
  return null;
}

/** Acción rápida por etapa; `confirmar` solo donde el paso avisa al cliente y no se deshace. */
const ACCION_POR_ETAPA = {
  por_preparar: { estado: "En preparación", etiqueta: "Empezar a preparar" },
  preparando: { estado: "Listo para retirar", etiqueta: "Listo para retirar" },
  listos: { estado: "Retirado", etiqueta: "Marcar retirado" },
  despachar: {
    estado: "Despachado",
    etiqueta: "Despachar",
    confirmar: (n) =>
      `¿Marcar como despachado el pedido N.º ${n}? Se avisa al cliente por mail.`,
  },
};

/** @param {string | null | undefined} desde */
function horasDesde(desde) {
  const t = desde ? new Date(desde).getTime() : NaN;
  return Number.isNaN(t) ? 0 : Math.max(0, (Date.now() - t) / 3_600_000);
}

/** @param {number} horas */
function formatAntiguedad(horas) {
  if (horas < 1) return "hace menos de 1 h";
  if (horas < 24) return `hace ${Math.floor(horas)} h`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias} día${dias === 1 ? "" : "s"}`;
}

/**
 * @param {{
 *   pedidos: Array<Record<string, any>>,
 *   depositos: Array<{ id_deposito: string, nombre_deposito: string }>,
 *   deposito: string,
 * }} props
 */
export function PreparacionBoard({ pedidos, depositos, deposito }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setDeposito(value) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set("deposito", value);
    else params.delete("deposito");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const grupos = Object.fromEntries(COLUMNAS.map((c) => [c.clave, []]));
  for (const p of pedidos) {
    const etapa = etapaDe(p);
    if (etapa) grupos[etapa].push(p);
  }
  // Los más viejos primero: es lo que hay que atender antes.
  for (const lista of Object.values(grupos)) {
    lista.sort((a, b) => new Date(a.estado_desde) - new Date(b.estado_desde));
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-palacio-muted">
          Sucursal
          <select
            value={deposito}
            onChange={(e) => setDeposito(e.target.value)}
            className="palacio-input max-w-xs"
          >
            <option value="">Todas</option>
            {depositos.map((d) => (
              <option key={d.id_deposito} value={d.id_deposito}>
                {d.nombre_deposito}
              </option>
            ))}
          </select>
        </label>
        {deposito ? (
          <p className="pb-2 text-xs text-palacio-muted">
            El filtro por sucursal aplica a retiros; los envíos no tienen una
            sola sucursal.
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNAS.map((col) => (
          <section key={col.clave} className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold text-zinc-900">
                {col.titulo}
              </h2>
              <span className="palacio-badge-lleno">
                {grupos[col.clave].length}
              </span>
            </div>
            {grupos[col.clave].length === 0 ? (
              <div className="palacio-card px-4 py-6 text-center text-xs text-palacio-muted">
                {col.vacio}
              </div>
            ) : (
              grupos[col.clave].map((p) => (
                <Tarjeta key={p.id_pedido} pedido={p} etapa={col.clave} />
              ))
            )}
          </section>
        ))}
      </div>
    </>
  );
}

function Tarjeta({ pedido: p, etapa }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(null);
  const accion = ACCION_POR_ETAPA[etapa];
  const horas = horasDesde(p.estado_desde);
  const demorado = horas >= UMBRAL_ALERTA_HORAS;
  const entrega =
    p.tipo_entrega === "Retiro por sucursal"
      ? `Retiro${p.nombre_deposito_retiro ? ` · ${p.nombre_deposito_retiro}` : ""}`
      : (p.tipo_entrega ?? "—");
  const unidades = Number(p.cantidad_unidades) || 0;

  function avanzar() {
    if (accion.confirmar && !window.confirm(accion.confirmar(p.numero))) return;
    setError(null);
    startTransition(async () => {
      const result = await cambiarEstadoPedidoWeb(p.id_pedido, accion.estado);
      if (!result.ok) setError(mensajeErrorPedidoWeb(result));
      router.refresh();
    });
  }

  return (
    <div
      className={`palacio-card px-4 py-3 transition hover:shadow-md ${
        demorado ? "border-amber-300 bg-amber-50/60" : ""
      }`}
    >
      <Link href={`/ventas/pedidos-web/${p.id_pedido}`} className="block">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-zinc-700">
            N.º {p.numero}
          </span>
          <span
            className={`text-xs ${demorado ? "font-semibold text-amber-800" : "text-palacio-muted"}`}
          >
            {demorado ? "⚠ " : ""}
            {formatAntiguedad(horas)}
          </span>
        </div>
        <p className="mt-1 text-sm font-medium text-zinc-900">
          {p.nombre_cliente}
        </p>
        <p className="mt-1 text-xs text-palacio-muted">{entrega}</p>
        <p className="mt-1 text-xs text-palacio-muted">
          {unidades} unidad{unidades === 1 ? "" : "es"} ·{" "}
          {Number(p.cantidad_lineas)} línea
          {Number(p.cantidad_lineas) === 1 ? "" : "s"}
        </p>
      </Link>
      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
      <button
        type="button"
        disabled={pending}
        onClick={avanzar}
        className="palacio-btn-primary mt-3 w-full px-3 py-1.5 text-xs"
      >
        {pending ? "Procesando…" : accion.etiqueta}
      </button>
    </div>
  );
}
