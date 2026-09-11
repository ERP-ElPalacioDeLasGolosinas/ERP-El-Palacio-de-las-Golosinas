import { Campo } from "./ui";

/**
 * Selector de factura asociada para ND / NC / remito. Las facturas del
 * proveedor llegan ya cargadas desde la página (todas las facturas no
 * anuladas); este componente solo filtra por el proveedor elegido en la
 * cabecera.
 *
 * @param {{
 *   label: string,
 *   requerido?: boolean,
 *   error?: string | null,
 *   idProveedor: string,
 *   facturas: Array<{ id_comprobante: string, id_proveedor: string, numero_formateado: string, nombre_tipo_comprobante: string, letra: string | null }>,
 *   value: string,
 *   onChange: (value: string) => void,
 * }} props
 */
export function FacturaAsociadaSelect({
  label,
  requerido = false,
  error,
  idProveedor,
  facturas,
  value,
  onChange,
}) {
  const opciones = idProveedor
    ? facturas.filter((f) => f.id_proveedor === idProveedor)
    : [];

  const hint = !idProveedor
    ? "Elegí primero un proveedor."
    : opciones.length === 0
      ? "El proveedor no tiene facturas registradas."
      : null;

  return (
    <Campo label={label} requerido={requerido} error={error}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="palacio-input"
        disabled={opciones.length === 0}
      >
        <option value="">
          {requerido ? "Seleccioná una factura…" : "Sin comprobante asociado"}
        </option>
        {opciones.map((f) => (
          <option key={f.id_comprobante} value={f.id_comprobante}>
            {f.nombre_tipo_comprobante}
            {f.letra ? ` (${f.letra})` : ""} · {f.numero_formateado}
          </option>
        ))}
      </select>
      {hint ? <p className="text-xs text-palacio-muted">{hint}</p> : null}
    </Campo>
  );
}
