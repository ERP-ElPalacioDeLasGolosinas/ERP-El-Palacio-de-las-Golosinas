"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  registrarMovimiento,
  validarStockDisponible,
} from "@/lib/movimientos/actions";

const CAMPO_POR_CODIGO = {
  MOV01: "cantidad",
  MOV02: "id_tipo_movimiento",
  MOV03: "id_producto",
  MOV04: "id_deposito",
};

const numFmt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
const hoy = () => new Date().toISOString().slice(0, 10);

const fechaFmt = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/**
 * @param {{
 *   tipos: Array<{ id_tipo_movimiento: string, nombre: string, signo: number }>,
 *   productos: Array<{ id_producto: string, nombre_completo: string }>,
 *   depositos: Array<{ id_deposito: string, nombre_deposito: string }>,
 *   movimientos: Array<{
 *     id_movimiento: string,
 *     fecha_movimiento: string,
 *     tipo_movimiento_nombre: string,
 *     producto_nombre_completo: string | null,
 *   }>,
 * }} props
 */
export function MovimientoForm({ tipos, productos, depositos, movimientos }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [form, setForm] = useState({
    id_tipo_movimiento: "",
    id_producto: "",
    id_deposito: "",
    cantidad: "",
    fecha_movimiento: hoy(),
    remito: "",
    corrige: false,
    id_movimiento_referencia: "",
  });
  const [errores, setErrores] = useState({});
  const [errorServer, setErrorServer] = useState(null);
  const [stockInfo, setStockInfo] = useState(null);

  const tipoElegido = useMemo(
    () => tipos.find((t) => t.id_tipo_movimiento === form.id_tipo_movimiento),
    [tipos, form.id_tipo_movimiento]
  );
  const signo = tipoElegido?.signo ?? null;
  const esEgreso = signo === -1;

  function set(campo, valor) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
    setErrores((prev) => ({ ...prev, [campo]: null }));
    if (["id_producto", "id_deposito", "cantidad", "id_tipo_movimiento"].includes(campo)) {
      setStockInfo(null);
    }
  }

  async function chequearStock() {
    if (!esEgreso || !form.id_producto || !form.id_deposito) {
      setStockInfo(null);
      return;
    }
    const cant = Number(form.cantidad) || 0;
    const res = await validarStockDisponible(
      form.id_producto,
      form.id_deposito,
      cant
    );
    if (res.error) {
      setStockInfo(null);
      return;
    }
    setStockInfo({ stockActual: res.stockActual, alcanza: res.alcanza, cant });
  }

  function validar() {
    const next = {};
    if (!form.id_tipo_movimiento) next.id_tipo_movimiento = "Elegí un concepto.";
    if (!form.id_producto) next.id_producto = "Elegí un producto.";
    if (!form.id_deposito) next.id_deposito = "Elegí un depósito.";
    const cant = Number(form.cantidad);
    if (form.cantidad.trim() === "" || !Number.isFinite(cant) || cant <= 0) {
      next.cantidad = "La cantidad debe ser mayor a cero.";
    }
    if (!form.fecha_movimiento) next.fecha_movimiento = "Elegí una fecha.";
    if (form.corrige && !form.id_movimiento_referencia) {
      next.id_movimiento_referencia = "Elegí el movimiento a corregir.";
    }
    setErrores(next);
    return Object.keys(next).length === 0;
  }

  function onSubmit(e) {
    e.preventDefault();
    setErrorServer(null);
    if (!validar()) return;

    if (esEgreso && stockInfo && !stockInfo.alcanza) {
      setErrores((prev) => ({
        ...prev,
        cantidad: "Stock insuficiente para este egreso.",
      }));
      return;
    }

    const fd = new FormData();
    fd.set("id_tipo_movimiento", form.id_tipo_movimiento);
    fd.set("id_producto", form.id_producto);
    fd.set("id_deposito", form.id_deposito);
    fd.set("cantidad", form.cantidad.trim());
    fd.set("fecha_movimiento", form.fecha_movimiento);
    fd.set("remito", form.remito.trim());
    if (form.corrige && form.id_movimiento_referencia) {
      fd.set("id_movimiento_referencia", form.id_movimiento_referencia);
    }

    startTransition(async () => {
      const result = await registrarMovimiento(fd);
      if (!result.ok) {
        const campo = result.code ? CAMPO_POR_CODIGO[result.code] : null;
        if (campo) {
          setErrores((prev) => ({ ...prev, [campo]: result.error }));
        } else {
          setErrorServer(result.error);
        }
        return;
      }
      router.push("/inventario/movimientos");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="palacio-card max-w-2xl p-5 md:p-6" noValidate>
      <div className="grid gap-4 md:grid-cols-2">
        <Campo label="Concepto" error={errores.id_tipo_movimiento} requerido>
          <select
            value={form.id_tipo_movimiento}
            onChange={(e) => set("id_tipo_movimiento", e.target.value)}
            className="palacio-input"
          >
            <option value="">Seleccioná un concepto…</option>
            {tipos.map((t) => (
              <option key={t.id_tipo_movimiento} value={t.id_tipo_movimiento}>
                {t.nombre} ({t.signo === 1 ? "+ suma" : "− resta"})
              </option>
            ))}
          </select>
          {signo != null ? (
            <p
              className={`text-xs font-medium ${signo === 1 ? "text-green-600" : "text-red-600"}`}
            >
              {signo === 1
                ? "Este concepto suma stock."
                : "Este concepto resta stock."}
            </p>
          ) : null}
        </Campo>

        <Campo label="Fecha del movimiento" error={errores.fecha_movimiento} requerido>
          <input
            type="date"
            value={form.fecha_movimiento}
            max={hoy()}
            onChange={(e) => set("fecha_movimiento", e.target.value)}
            className="palacio-input"
          />
        </Campo>

        <Campo label="Producto" error={errores.id_producto} requerido full>
          <select
            value={form.id_producto}
            onChange={(e) => set("id_producto", e.target.value)}
            onBlur={chequearStock}
            className="palacio-input"
          >
            <option value="">Seleccioná un producto…</option>
            {productos.map((p) => (
              <option key={p.id_producto} value={p.id_producto}>
                {p.nombre_completo}
              </option>
            ))}
          </select>
        </Campo>

        <Campo label="Depósito" error={errores.id_deposito} requerido>
          <select
            value={form.id_deposito}
            onChange={(e) => set("id_deposito", e.target.value)}
            onBlur={chequearStock}
            className="palacio-input"
          >
            <option value="">Seleccioná un depósito…</option>
            {depositos.map((d) => (
              <option key={d.id_deposito} value={d.id_deposito}>
                {d.nombre_deposito}
              </option>
            ))}
          </select>
        </Campo>

        <Campo label="Cantidad" error={errores.cantidad} requerido>
          <input
            type="number"
            step="any"
            min="0"
            value={form.cantidad}
            onChange={(e) => set("cantidad", e.target.value)}
            onBlur={chequearStock}
            className="palacio-input"
            placeholder="0"
          />
          {esEgreso && stockInfo ? (
            <p
              className={`text-xs ${stockInfo.alcanza ? "text-palacio-muted" : "text-red-600"}`}
            >
              Stock disponible: {numFmt.format(stockInfo.stockActual ?? 0)}
              {!stockInfo.alcanza ? " — no alcanza para este egreso." : ""}
            </p>
          ) : null}
        </Campo>

        <Campo label="Remito (opcional)" error={errores.remito} full>
          <input
            type="text"
            value={form.remito}
            onChange={(e) => set("remito", e.target.value)}
            className="palacio-input"
            placeholder="N.º de remito / comprobante"
            maxLength={80}
          />
        </Campo>

        <div className="flex flex-col gap-2 md:col-span-2">
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={form.corrige}
              onChange={(e) => set("corrige", e.target.checked)}
              className="size-4 accent-palacio-red"
            />
            ¿Corrige un movimiento existente?
          </label>
          {form.corrige ? (
            <Campo
              label="Movimiento a corregir"
              error={errores.id_movimiento_referencia}
            >
              <select
                value={form.id_movimiento_referencia}
                onChange={(e) =>
                  set("id_movimiento_referencia", e.target.value)
                }
                className="palacio-input"
              >
                <option value="">Seleccioná el movimiento original…</option>
                {movimientos.map((m) => (
                  <option key={m.id_movimiento} value={m.id_movimiento}>
                    {fechaFmt.format(
                      new Date(`${m.fecha_movimiento}T00:00:00`)
                    )}{" "}
                    — {m.tipo_movimiento_nombre}
                    {m.producto_nombre_completo
                      ? ` — ${m.producto_nombre_completo}`
                      : ""}
                  </option>
                ))}
              </select>
              {movimientos.length === 0 ? (
                <p className="text-xs text-palacio-muted">
                  No hay movimientos previos para referenciar.
                </p>
              ) : null}
            </Campo>
          ) : null}
        </div>
      </div>

      {errorServer ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorServer}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-palacio-border pt-4">
        <button
          type="submit"
          disabled={pending}
          className="palacio-btn-primary px-4 py-2.5 text-sm"
        >
          {pending ? "Registrando…" : "Registrar movimiento"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/inventario/movimientos")}
          disabled={pending}
          className="palacio-btn-secondary px-4 py-2.5 text-sm"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Campo({ label, error, requerido = false, full = false, children }) {
  return (
    <div className={`flex flex-col gap-1.5 ${full ? "md:col-span-2" : ""}`}>
      <label className="text-sm font-medium text-zinc-800">
        {label} {requerido ? <span className="text-palacio-red">*</span> : null}
      </label>
      {children}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
