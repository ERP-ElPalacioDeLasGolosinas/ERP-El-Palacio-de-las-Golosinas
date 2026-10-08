import { badgeEstadoCaja } from "@/lib/cajas/constantes";
import { fechaHora, moneda } from "@/components/cajas/formato";

/**
 * Datos de apertura (y cierre, si corresponde) de una caja.
 *
 * @param {{ caja: Record<string, any> }} props
 */
export function CajaEncabezado({ caja }) {
  return (
    <div className="palacio-card mb-6 flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4 text-sm">
      <span className={badgeEstadoCaja(caja.estado)}>{caja.estado}</span>
      <Dato label="Depósito" valor={caja.nombre_deposito || "Sin asignar"} />
      <Dato label="Apertura" valor={`${fechaHora(caja.fecha_apertura)} · ${caja.abierta_por_nombre}`} />
      <Dato label="Monto inicial" valor={moneda(caja.monto_inicial)} />
      {caja.estado === "Cerrada" ? (
        <Dato label="Cierre" valor={`${fechaHora(caja.fecha_cierre)} · ${caja.cerrada_por_nombre ?? "—"}`} />
      ) : null}
      {caja.observaciones_apertura ? <Dato label="Obs. apertura" valor={caja.observaciones_apertura} /> : null}
      {caja.observaciones_cierre ? <Dato label="Obs. cierre" valor={caja.observaciones_cierre} /> : null}
    </div>
  );
}

function Dato({ label, valor }) {
  return (
    <div>
      <p className="text-[11px] font-semibold tracking-wider text-palacio-muted uppercase">{label}</p>
      <p className="font-medium text-zinc-900">{valor}</p>
    </div>
  );
}
