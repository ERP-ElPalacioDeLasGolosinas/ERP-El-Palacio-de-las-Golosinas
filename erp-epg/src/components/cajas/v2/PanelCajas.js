"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { aprobarAperturaCaja, rechazarAperturaCaja } from "@/lib/cajas/v2-actions";
import { mapErrorCaja } from "@/lib/cajas/errores";
import { nombreCaja } from "@/lib/cajas/v2-estado";
import { fechaHora, moneda } from "@/components/cajas/formato";
import { CajaRegistradoraForm } from "@/components/cajas/v2/CajaRegistradoraForm";
import { DuracionSesion } from "@/components/cajas/v2/DuracionSesion";
import { LevantarCajaForm } from "@/components/cajas/v2/LevantarCajaForm";
import { TarjetaCaja } from "@/components/cajas/v2/TarjetaCaja";

/**
 * Gerente: panorama de todas las cajas del local. Aprueba o rechaza aperturas,
 * entra a revisar cierres pedidos y administra las cajas físicas. Se refresca
 * cada 15 segundos para ver los pedidos nuevos.
 *
 * @param {{
 *   cajas: Array<Record<string, any>>,
 *   sucursal: { id_deposito: string, nombre_deposito: string },
 *   siguiente: number,
 *   depositos: Array<{ id_deposito: string, nombre_deposito: string }>,
 *   empleados?: Array<{ id_usuario: string, nombre_completo: string }>,
 * }} props
 */
export function PanelCajas({ cajas, sucursal, creando = false, siguiente, depositos, empleados = [] }) {
  const router = useRouter();
  const [editando, setEditando] = useState(/** @type {string | null} */ (null));
  const cerrarCreacion = () => router.replace(`/ventas/cajas?sucursal=${sucursal.id_deposito}`);

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 15000);
    return () => clearInterval(id);
  }, [router]);

  const activas = cajas.filter((c) => c.activa || c.sesion);
  const inactivas = cajas.filter((c) => !c.activa && !c.sesion);
  const cuenta = (estado) => activas.filter((c) => (c.sesion?.estado ?? null) === estado).length;

  return (
    <div>
      <div>
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Contador label="Libres" valor={cuenta(null)} />
          <Contador label="Ocupadas" valor={cuenta("Abierta")} />
          <Contador label="Aperturas pendientes" valor={cuenta("Pendiente")} resaltar={cuenta("Pendiente") > 0} />
          <Contador label="Cierres pedidos" valor={cuenta("Cierre solicitado")} resaltar={cuenta("Cierre solicitado") > 0} />
        </div>

        {creando ? (
          <div className="mb-4">
            <div className="palacio-card max-w-md p-5">
              <h2 className="mb-1 text-sm font-semibold text-zinc-900">Nueva caja</h2>
              <p className="mb-4 text-xs text-palacio-muted">La caja vende el stock de {sucursal.nombre_deposito}.</p>
              <CajaRegistradoraForm
                key={siguiente}
                depositos={depositos}
                sugerido={siguiente}
                idDepositoFijo={sucursal.id_deposito}
                onListo={cerrarCreacion}
              />
              <button type="button" onClick={cerrarCreacion} className="mt-3 text-sm underline">
                Cancelar
              </button>
            </div>
          </div>
        ) : null}

        {activas.length === 0 ? (
          <div className="palacio-card px-6 py-12 text-center text-sm text-palacio-muted">
            Todavía no hay cajas. Creá la primera con el botón Nueva caja.
          </div>
        ) : (
          <ul className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {activas.map((c) => (
              <li key={c.id_registradora}>
                {editando === c.id_registradora ? (
                  <div className="palacio-card p-4">
                    <p className="mb-3 text-sm font-semibold text-zinc-900">Editar {nombreCaja(c)}</p>
                    <CajaRegistradoraForm depositos={depositos} caja={c} onListo={() => setEditando(null)} />
                  </div>
                ) : (
                  <TarjetaCajaGerente caja={c} empleados={empleados} onEditar={() => setEditando(c.id_registradora)} />
                )}
              </li>
            ))}
          </ul>
        )}

        {inactivas.length > 0 ? (
          <div className="mt-6">
            <h3 className="mb-2 text-xs font-semibold tracking-wider text-palacio-muted uppercase">Cajas inactivas</h3>
            <ul className="space-y-2">
              {inactivas.map((c) => (
                <li key={c.id_registradora} className="palacio-card px-4 py-3 text-sm">
                  {editando === c.id_registradora ? (
                    <CajaRegistradoraForm depositos={depositos} caja={c} onListo={() => setEditando(null)} />
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-palacio-muted">
                        {nombreCaja(c)} · {c.nombre_deposito}
                      </span>
                      <button type="button" onClick={() => setEditando(c.id_registradora)} className="text-sm underline">
                        Editar
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

    </div>
  );
}

function Contador({ label, valor, resaltar = false }) {
  return (
    <div className={`palacio-card px-4 py-3 ${resaltar ? "border-amber-300 bg-amber-50" : ""}`}>
      <p className="text-[11px] font-semibold tracking-wider text-palacio-muted uppercase">{label}</p>
      <p className="text-2xl font-bold text-zinc-900">{valor}</p>
    </div>
  );
}

/** @param {{ caja: Record<string, any>, empleados: Array<{ id_usuario: string, nombre_completo: string }>, onEditar: () => void }} props */
function TarjetaCajaGerente({ caja, empleados, onEditar }) {
  const s = caja.sesion;
  const [levantando, setLevantando] = useState(false);
  const cierre = s?.estado === "Cierre solicitado";

  return (
    <TarjetaCaja caja={caja} mostrarDeposito={false}>
        {!s ? (
          levantando ? (
            <LevantarCajaForm
              idRegistradora={caja.id_registradora}
              empleados={empleados}
              onListo={() => setLevantando(false)}
              onCancelar={() => setLevantando(false)}
            />
          ) : (
            <div className="mt-auto flex flex-wrap gap-2">
              <button type="button" onClick={() => setLevantando(true)} className="palacio-btn-primary px-3 py-2 text-sm">
                Levantar caja
              </button>
              <button type="button" onClick={onEditar} className="palacio-btn-secondary px-3 py-2 text-sm">
                Editar
              </button>
            </div>
          )
        ) : s.estado === "Pendiente" ? (
          <AprobarApertura sesion={s} />
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <Dato label="Empleado" valor={s.empleado_nombre} />
              <Dato label="Apertura" valor={fechaHora(s.fecha_apertura)} />
              <Dato label="Duración" valor={<DuracionSesion desde={s.fecha_apertura} />} />
              <Dato label="Autorizó" valor={s.autorizada_por_nombre ?? "—"} />
              <Dato label="Monto inicial" valor={moneda(s.monto_inicial)} />
              <Dato label="Efectivo en caja" valor={moneda(s.saldo_efectivo)} />
              <Dato label="Ingresos" valor={moneda(s.total_ingresos)} />
              <Dato label="Ventas" valor={s.cantidad_ventas ?? 0} />
            </dl>
            <Link
              href={`/ventas/cajas/${s.id_caja}`}
              className={`${cierre ? "palacio-btn-primary" : "palacio-btn-secondary"} mt-auto inline-flex justify-center px-3 py-2 text-sm`}
            >
              {cierre ? "Revisar cierre" : "Ver caja"}
            </Link>
          </>
        )}
    </TarjetaCaja>
  );
}

function Dato({ label, valor }) {
  return (
    <>
      <dt className="text-palacio-muted">{label}</dt>
      <dd className="text-right font-medium break-words text-zinc-900">{valor}</dd>
    </>
  );
}

/** @param {{ sesion: Record<string, any> }} props */
function AprobarApertura({ sesion }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState(null);

  function ejecutar(accion) {
    setError(null);
    startTransition(async () => {
      const result =
        accion === "aprobar"
          ? await aprobarAperturaCaja({ id_sesion: sesion.id_sesion })
          : await rechazarAperturaCaja({ id_sesion: sesion.id_sesion, motivo });
      if (!result.ok) setError(mapErrorCaja(result).message);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-zinc-800">
        <span className="font-medium">{sesion.empleado_nombre}</span> pide abrir con{" "}
        <span className="font-medium">{moneda(sesion.monto_inicial)}</span>
        <span className="block text-xs text-palacio-muted">
          {fechaHora(sesion.fecha_solicitud)}
          {sesion.observaciones_apertura ? ` · ${sesion.observaciones_apertura}` : ""}
        </span>
      </p>
      {rechazando ? (
        <div className="space-y-2">
          <input
            type="text"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={300}
            className="palacio-input"
            placeholder="Motivo del rechazo (opcional)"
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => ejecutar("rechazar")} disabled={pending} className="palacio-btn-primary px-3 py-2 text-sm">
              {pending ? "Rechazando…" : "Confirmar rechazo"}
            </button>
            <button type="button" onClick={() => setRechazando(false)} disabled={pending} className="palacio-btn-secondary px-3 py-2 text-sm">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button type="button" onClick={() => ejecutar("aprobar")} disabled={pending} className="palacio-btn-primary px-3 py-2 text-sm">
            {pending ? "Aprobando…" : "Aprobar apertura"}
          </button>
          <button type="button" onClick={() => setRechazando(true)} disabled={pending} className="palacio-btn-secondary px-3 py-2 text-sm">
            Rechazar
          </button>
        </div>
      )}
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">{error}</p> : null}
    </div>
  );
}
