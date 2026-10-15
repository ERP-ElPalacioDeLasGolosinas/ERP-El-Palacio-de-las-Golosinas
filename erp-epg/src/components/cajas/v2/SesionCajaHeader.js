import { fechaHora, moneda } from "@/components/cajas/formato";
import { DuracionSesion } from "@/components/cajas/v2/DuracionSesion";
import { badgeSesionCaja, etiquetaSesionCaja, nombreCaja } from "@/lib/cajas/v2-estado";

/**
 * Cabecera del POS: número de caja, empleado y duración de la sesión.
 *
 * @param {{ sesion: Record<string, any> }} props
 */
export function SesionCajaHeader({ sesion }) {
  return (
    <div className="palacio-card mb-6 flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4 text-sm">
      <div>
        <p className="text-[11px] font-semibold tracking-wider text-palacio-muted uppercase">Caja</p>
        <p className="text-xl font-bold text-zinc-900">{nombreCaja({ numero: sesion.numero, nombre: sesion.nombre_caja })}</p>
      </div>
      <Dato label="Empleado" valor={sesion.empleado_nombre} />
      <div>
        <p className="text-[11px] font-semibold tracking-wider text-palacio-muted uppercase">Duración de la sesión</p>
        <p className="text-lg font-semibold text-zinc-900">
          <DuracionSesion desde={sesion.fecha_apertura} />
        </p>
      </div>
      <Dato label="Depósito" valor={sesion.nombre_deposito} />
      <Dato label="Monto inicial" valor={moneda(sesion.monto_inicial)} />
      <Dato
        label="Autorizada"
        valor={`${fechaHora(sesion.fecha_apertura)}${sesion.autorizada_por_nombre ? ` · ${sesion.autorizada_por_nombre}` : ""}`}
      />
      <span className={`${badgeSesionCaja(sesion.estado)} ml-auto`}>{etiquetaSesionCaja(sesion.estado)}</span>
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
