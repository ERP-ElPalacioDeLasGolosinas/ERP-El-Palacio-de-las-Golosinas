"use client";

import { useActionState, useState } from "react";
import { confirmarPedido } from "@/app/(tienda)/tienda/checkout/actions";

const MEDIOS = ["Transferencia", "Tarjeta de débito", "Tarjeta de crédito"];
const ENVIO = "Envío a domicilio";
const RETIRO = "Retiro por sucursal";
const INPUT = "palacio-input mt-1 w-full";

const precioFmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

export default function ConfirmarPedido({ subtotal, costoEnvio, sucursales, nombre, direccion }) {
  const [entrega, setEntrega] = useState(ENVIO);
  const [state, formAction, pending] = useActionState(
    async (_prev, formData) => (await confirmarPedido(formData)) ?? { error: null },
    { error: null }
  );
  const total = subtotal + (entrega === ENVIO ? costoEnvio : 0);

  return (
    <form action={formAction} className="mt-6">
      <h2 className="font-semibold">Entrega</h2>
      <label className="palacio-card mt-2 flex items-center gap-3 p-4">
        <input type="radio" name="entrega" value={ENVIO} checked={entrega === ENVIO} onChange={() => setEntrega(ENVIO)} />
        <span className="flex-1">Envío a domicilio</span>
        <span className="text-sm text-palacio-muted">{precioFmt.format(costoEnvio)}</span>
      </label>
      <label className="palacio-card mt-2 flex items-center gap-3 p-4">
        <input type="radio" name="entrega" value={RETIRO} checked={entrega === RETIRO} onChange={() => setEntrega(RETIRO)} />
        <span className="flex-1">Retiro por sucursal</span>
        <span className="text-sm text-palacio-muted">Gratis</span>
      </label>

      {entrega === ENVIO ? (
        <div className="palacio-card mt-2 grid gap-3 p-4 sm:grid-cols-2">
          <label className="text-sm">
            Destinatario
            <input name="destinatario" required defaultValue={nombre ?? ""} className={INPUT} />
          </label>
          <label className="text-sm">
            Localidad
            <input name="localidad" required className={INPUT} />
          </label>
          <label className="text-sm sm:col-span-2">
            Dirección
            <input name="direccion" required defaultValue={direccion ?? ""} className={INPUT} />
          </label>
          <label className="text-sm sm:col-span-2">
            Observaciones (opcional)
            <input name="observaciones" className={INPUT} />
          </label>
        </div>
      ) : sucursales.length === 0 ? (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Ninguna sucursal tiene stock para todo tu pedido. Elegí envío a domicilio o ajustá el carrito.
        </p>
      ) : (
        sucursales.map((s, i) => (
          <label key={s.id_deposito} className="palacio-card mt-2 flex items-start gap-3 p-4">
            <input type="radio" name="sucursal" value={s.id_deposito} defaultChecked={i === 0} required className="mt-1" />
            <span>
              <span className="block font-medium">{s.nombre_deposito}</span>
              <span className="block text-sm text-palacio-muted">
                {[s.direccion_deposito, s.telefono_deposito].filter(Boolean).join(" · ")}
              </span>
              {s.horario_apertura && s.horario_cierre ? (
                <span className="block text-sm text-palacio-muted">
                  {s.horario_apertura.slice(0, 5)} a {s.horario_cierre.slice(0, 5)} hs
                </span>
              ) : null}
            </span>
          </label>
        ))
      )}

      <h2 className="mt-6 font-semibold">Medio de pago</h2>
      {MEDIOS.map((medio, i) => (
        <label key={medio} className="palacio-card mt-2 flex items-center gap-3 p-4">
          <input type="radio" name="medio" value={medio} defaultChecked={i === 0} />
          <span>{medio}</span>
        </label>
      ))}
      <p className="mt-2 text-sm text-palacio-muted">
        Al confirmar, tu pedido queda pendiente de pago y pasás a pagarlo. El stock se descuenta al aprobarse el pago.
      </p>

      <div className="mt-6 text-right">
        {entrega === ENVIO ? (
          <p className="text-sm text-palacio-muted">Envío: {precioFmt.format(costoEnvio)}</p>
        ) : null}
        <p className="text-xl font-bold">Total: {precioFmt.format(total)}</p>
      </div>
      <div className="mt-4 flex flex-col items-end gap-3">
        {state?.error ? (
          <p className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending || (entrega === RETIRO && sucursales.length === 0)}
          className="palacio-btn-primary px-5 py-2.5 text-sm"
        >
          {pending ? "Confirmando…" : "Confirmar pedido"}
        </button>
      </div>
    </form>
  );
}
