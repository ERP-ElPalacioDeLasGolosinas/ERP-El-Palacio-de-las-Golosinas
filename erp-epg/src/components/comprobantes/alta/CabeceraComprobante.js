import { Campo } from "./ui";

/**
 * Cabecera compartida por todos los tipos de documento de proveedor
 * (factura / nota de débito / nota de crédito / remito). El vencimiento
 * solo aplica a la factura; el resto de los tipos no lo usan.
 *
 * @param {{
 *   cab: Record<string, string>,
 *   setCampo: (campo: string, valor: string) => void,
 *   errores: Record<string, string | null | undefined>,
 *   proveedores: Array<{ id_proveedor: string, nombre_proveedor: string }>,
 *   tipos: Array<{ id_tipo_comprobante: string, nombre_tipo_comprobante: string, letra: string | null }>,
 *   claseActual: string,
 * }} props
 */
export function CabeceraComprobante({
  cab,
  setCampo,
  errores,
  proveedores,
  tipos,
  claseActual,
}) {
  return (
    <div className="palacio-card p-5 md:p-6">
      <h2 className="mb-4 text-sm font-semibold text-zinc-900">
        Datos del comprobante
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        <Campo label="Proveedor" error={errores.id_proveedor} requerido>
          <select
            value={cab.id_proveedor}
            onChange={(e) => setCampo("id_proveedor", e.target.value)}
            className="palacio-input"
          >
            <option value="">Seleccioná un proveedor…</option>
            {proveedores.map((p) => (
              <option key={p.id_proveedor} value={p.id_proveedor}>
                {p.nombre_proveedor}
              </option>
            ))}
          </select>
        </Campo>

        <Campo
          label="Tipo de comprobante"
          error={errores.id_tipo_comprobante}
          requerido
        >
          <select
            value={cab.id_tipo_comprobante}
            onChange={(e) => setCampo("id_tipo_comprobante", e.target.value)}
            className="palacio-input"
          >
            <option value="">Seleccioná un tipo…</option>
            {tipos.map((t) => (
              <option key={t.id_tipo_comprobante} value={t.id_tipo_comprobante}>
                {t.nombre_tipo_comprobante}
                {t.letra ? ` (${t.letra})` : ""}
              </option>
            ))}
          </select>
        </Campo>

        <Campo label="Punto de venta" error={errores.numero} requerido>
          <input
            type="number"
            min="1"
            step="1"
            value={cab.punto_venta}
            onChange={(e) => setCampo("punto_venta", e.target.value)}
            className="palacio-input"
            placeholder="Ej: 1"
          />
        </Campo>

        <Campo label="Número" requerido>
          <input
            type="number"
            min="1"
            step="1"
            value={cab.numero}
            onChange={(e) => setCampo("numero", e.target.value)}
            className="palacio-input"
            placeholder="Ej: 12345"
          />
        </Campo>

        <Campo label="Fecha del comprobante" error={errores.fechas} requerido>
          <input
            type="date"
            value={cab.fecha_comprobante}
            onChange={(e) => setCampo("fecha_comprobante", e.target.value)}
            className="palacio-input"
          />
        </Campo>

        {claseActual === "factura" ? (
          <Campo label="Vencimiento (opcional)">
            <input
              type="date"
              value={cab.fecha_vencimiento}
              onChange={(e) => setCampo("fecha_vencimiento", e.target.value)}
              className="palacio-input"
            />
          </Campo>
        ) : null}

        <Campo label="Observaciones (opcional)" full>
          <textarea
            value={cab.observaciones}
            onChange={(e) => setCampo("observaciones", e.target.value)}
            rows={2}
            maxLength={500}
            className="palacio-input"
            placeholder="Remito, orden de compra, notas…"
          />
        </Campo>
      </div>
    </div>
  );
}
