import { badgeSesionCaja, etiquetaSesionCaja, nombreCaja } from "@/lib/cajas/v2-estado";

/** Color de borde y franja superior de la tarjeta según el estado de la sesión. */
const COLOR_ESTADO = {
  Pendiente: { borde: "border-amber-300", franja: "bg-amber-400" },
  Abierta: { borde: "border-emerald-300", franja: "bg-emerald-500" },
  "Cierre solicitado": { borde: "border-sky-300", franja: "bg-sky-500" },
};
const COLOR_LIBRE = { borde: "border-zinc-200", franja: "bg-zinc-300" };

/**
 * Tarjeta rectangular de una caja: franja de color, nombre, depósito y estado.
 * La comparten el panel del gerente y el selector de caja del empleado.
 * Con `as="button"` se usa como opción seleccionable.
 *
 * @param {{
 *   caja: Record<string, any>,
 *   as?: "div" | "button",
 *   seleccionada?: boolean,
 *   children?: import("react").ReactNode,
 * } & Record<string, any>} props
 */
export function TarjetaCaja({
  caja,
  as: Tag = "div",
  seleccionada = false,
  mostrarDeposito = true,
  children,
  className = "",
  ...rest
}) {
  const estado = caja.sesion?.estado;
  const color = COLOR_ESTADO[estado] ?? COLOR_LIBRE;
  const extra = Tag === "button" ? { type: "button" } : {};

  return (
    <Tag
      {...extra}
      {...rest}
      className={`palacio-card flex h-full w-full flex-col overflow-hidden border-2 text-left ${color.borde} ${
        seleccionada ? "ring-2 ring-zinc-900 ring-offset-2" : ""
      } ${className}`}
    >
      <div className={`h-1.5 w-full ${color.franja}`} />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-zinc-900">{nombreCaja(caja)}</p>
            {mostrarDeposito ? <p className="truncate text-xs text-palacio-muted">{caja.nombre_deposito}</p> : null}
          </div>
          <span className={`${badgeSesionCaja(estado)} shrink-0`}>{etiquetaSesionCaja(estado)}</span>
        </div>
        {children}
      </div>
    </Tag>
  );
}
