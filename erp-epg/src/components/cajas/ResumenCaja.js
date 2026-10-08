import { moneda } from "@/components/cajas/formato";

/**
 * Resumen de la caja: el efectivo (único que se compara en el arqueo) y el
 * resto de los medios por separado.
 *
 * @param {{ resumen: Record<string, any> }} props
 */
export function ResumenCaja({ resumen }) {
  const efectivo = resumen?.efectivo ?? {};
  const otros = (resumen?.medios ?? []).filter((m) => !m.es_efectivo);

  return (
    <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
      <div className="palacio-card p-5">
        <h2 className="text-sm font-semibold text-zinc-900">Efectivo en caja</h2>
        <dl className="mt-3 space-y-1.5 text-sm">
          <Fila label="Monto inicial" valor={moneda(efectivo.monto_inicial)} />
          <Fila label="Ingresos" valor={`+ ${moneda(efectivo.ingresos)}`} className="text-emerald-700" />
          <Fila label="Egresos" valor={`− ${moneda(efectivo.egresos)}`} className="text-red-700" />
        </dl>
        <div className="mt-3 flex items-baseline justify-between border-t border-palacio-border pt-3">
          <span className="text-sm font-medium text-zinc-800">Saldo teórico</span>
          <span className="text-xl font-bold text-zinc-900">{moneda(efectivo.saldo_teorico)}</span>
        </div>
      </div>

      <div className="palacio-card p-5">
        <h2 className="text-sm font-semibold text-zinc-900">Otros medios</h2>
        {otros.length === 0 ? (
          <p className="mt-3 text-sm text-palacio-muted">Sin movimientos en otros medios.</p>
        ) : (
          <dl className="mt-3 space-y-1.5 text-sm">
            {otros.map((m) => (
              <Fila
                key={m.id_medio_pago}
                label={
                  <>
                    {m.nombre_medio_pago}
                    {m.simulado ? (
                      <span className="ml-1.5 rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 uppercase">
                        simulado
                      </span>
                    ) : null}
                  </>
                }
                valor={moneda(m.saldo)}
              />
            ))}
          </dl>
        )}
        <div className="mt-3 flex items-baseline justify-between border-t border-palacio-border pt-3 text-sm">
          <span className="text-palacio-muted">
            {resumen?.cantidad_movimientos ?? 0} movimiento{Number(resumen?.cantidad_movimientos) === 1 ? "" : "s"}
          </span>
          <span className="text-palacio-muted">
            Ingresos {moneda(resumen?.total_ingresos)} · Egresos {moneda(resumen?.total_egresos)}
          </span>
        </div>
      </div>
    </div>
  );
}

function Fila({ label, valor, className = "text-zinc-900" }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-palacio-muted">{label}</dt>
      <dd className={`font-medium ${className}`}>{valor}</dd>
    </div>
  );
}
