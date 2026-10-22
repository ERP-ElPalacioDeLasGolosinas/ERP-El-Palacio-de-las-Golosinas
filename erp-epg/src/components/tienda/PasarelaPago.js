"use client";

import { useActionState } from "react";
import { pagarPedido } from "@/app/(tienda)/tienda/checkout/actions";

const CAMPOS_TRANSFERENCIA = [
  ["transferencia_titular", "Titular"],
  ["transferencia_banco", "Banco"],
  ["transferencia_cbu", "CBU"],
  ["transferencia_alias", "Alias"],
  ["transferencia_cuit", "CUIT"],
];
const CUOTAS = [1, 3, 6, 12];

// metodo: "transferencia" | "debito" | "credito". Pasarela simulada (D-034).
export default function PasarelaPago({ idPedido, metodo, numeroPedido, datosTransferencia = {} }) {
  const [state, formAction, pending] = useActionState(pagarPedido, { error: null });
  const esTarjeta = metodo === "debito" || metodo === "credito";
  const campos = CAMPOS_TRANSFERENCIA.filter(([clave]) => datosTransferencia[clave]);

  return (
    <form action={formAction} className="mt-6">
      <input type="hidden" name="pedido" value={idPedido} />
      <input type="hidden" name="metodo" value={metodo} />

      {esTarjeta ? (
        <>
          <section className="palacio-card space-y-3 p-4">
            <h2 className="font-semibold">Datos de la tarjeta de {metodo === "credito" ? "crédito" : "débito"}</h2>
            <label className="block text-sm">
              Número
              <input
                name="numero"
                inputMode="numeric"
                autoComplete="off"
                placeholder="4111 1111 1111 1111"
                className="palacio-input mt-1 w-full"
                required
              />
            </label>
            <label className="block text-sm">
              Titular
              <input name="titular" autoComplete="off" className="palacio-input mt-1 w-full" required />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                Vencimiento (MM/AA)
                <input name="vencimiento" placeholder="12/30" autoComplete="off" className="palacio-input mt-1 w-full" required />
              </label>
              <label className="block text-sm">
                CVV
                <input
                  name="cvv"
                  inputMode="numeric"
                  maxLength={4}
                  autoComplete="off"
                  className="palacio-input mt-1 w-full"
                  required
                />
              </label>
            </div>
            {metodo === "credito" ? (
              <label className="block text-sm">
                Cuotas
                <select name="cuotas" defaultValue="1" className="palacio-input mt-1 w-full">
                  {CUOTAS.map((c) => (
                    <option key={c} value={c}>
                      {c} {c === 1 ? "cuota" : "cuotas"}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </section>

          <aside className="mt-4 rounded-lg border border-dashed border-zinc-300 p-4 text-sm">
            <p className="font-semibold">Tarjetas de prueba</p>
            <ul className="mt-2 space-y-1 text-palacio-muted">
              <li>
                <code>4111 1111 1111 1111</code> — aprobada
              </li>
              <li>
                <code>4000 0000 0000 0002</code> — rechazo por fondos insuficientes
              </li>
              <li>
                <code>4000 0000 0000 0069</code> — rechazo por datos
              </li>
            </ul>
            <p className="mt-2 text-palacio-muted">
              Cualquier otro número válido se aprueba, con vencimiento futuro y CVV de 3 o 4 dígitos. Es una pasarela
              simulada: no se cobra nada.
            </p>
          </aside>
        </>
      ) : (
        <section className="palacio-card p-4">
          <h2 className="font-semibold">Datos para la transferencia</h2>
          {campos.length > 0 ? (
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              {campos.map(([clave, etiqueta]) => (
                <div key={clave} className="contents">
                  <dt className="text-palacio-muted">{etiqueta}</dt>
                  <dd className="font-medium">{datosTransferencia[clave]}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-3 text-sm text-palacio-muted">Todavía no están cargados los datos bancarios.</p>
          )}
          {datosTransferencia.transferencia_instrucciones ? (
            <p className="mt-3 text-sm">{datosTransferencia.transferencia_instrucciones}</p>
          ) : null}
          <p className="mt-3 text-sm text-palacio-muted">
            Indicá el N° de pedido {numeroPedido} en el concepto. En esta simulación la acreditación es inmediata.
          </p>
        </section>
      )}

      <div className="mt-6 flex flex-col items-end gap-3">
        {state?.error ? (
          <p className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        ) : null}
        <button type="submit" disabled={pending} className="palacio-btn-primary px-5 py-2.5 text-sm">
          {pending ? "Procesando pago…" : esTarjeta ? "Pagar" : "Ya transferí — simular acreditación"}
        </button>
      </div>
    </form>
  );
}
