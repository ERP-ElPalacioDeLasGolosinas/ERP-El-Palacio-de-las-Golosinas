import { existsSync } from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import { obtenerVenta } from "@/lib/ventas/actions";
import { obtenerEmisor } from "@/lib/ventas/emisor";
import { AutoImprimir } from "@/components/ventas/AutoImprimir";

export const metadata = {
  title: "Comprobante de venta | Palacio · ERP",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// El logo es opcional: si el archivo no está en /public, el encabezado sale sin imagen.
const LOGO_SRC = "/logo-palacio.png";
const hayLogo = () => existsSync(path.join(process.cwd(), "public", LOGO_SRC));

const fechaFmt = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const monedaFmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

function formatFecha(valor) {
  if (!valor) return "—";
  const d = new Date(String(valor).length <= 10 ? `${valor}T00:00:00` : valor);
  return Number.isNaN(d.getTime()) ? "—" : fechaFmt.format(d);
}

const moneda = (n) => monedaFmt.format(Number(n) || 0);

/**
 * @param {{ params: Promise<{ id: string }> }} props
 */
export default async function ComprobanteVentaPage({ params }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const [{ data }, emisor] = await Promise.all([obtenerVenta(id), obtenerEmisor()]);
  if (!data?.venta) notFound();

  const venta = data.venta;
  const detalle = data.detalle ?? [];
  const medios = data.cobro?.medios?.length ? data.cobro.medios : (data.cobro_caja ?? []);
  const descuentoPct = Number(venta.descuento_porcentaje) || 0;
  const saldo = Number(venta.saldo_pendiente) || 0;

  return (
    <main className="hoja-comprobante">
      <AutoImprimir />

      <header className="comprobante-encabezado">
        <div>
          {hayLogo() ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={LOGO_SRC} alt="El Palacio de las Golosinas" className="comprobante-logo" />
          ) : null}
          <p className="comprobante-razon">{emisor.razonSocial || "—"}</p>
          <p>CUIT: {emisor.cuit || "—"}</p>
          <p>Domicilio: {emisor.domicilio || "—"}</p>
          <p>Teléfono: {emisor.telefono || "—"}</p>
        </div>
        <div className="comprobante-recuadro">
          <p className="comprobante-letra">{venta.letra || "—"}</p>
          <p className="comprobante-tipo">{venta.nombre_tipo_comprobante}</p>
          <p className="comprobante-numero">N.º {venta.numero_formateado}</p>
          <p>Fecha: {formatFecha(venta.fecha_comprobante)}</p>
        </div>
      </header>

      <section className="comprobante-bloque">
        <p>
          <strong>Cliente:</strong> {venta.nombre_cliente || "—"}
          {venta.nombre_tipo_cliente ? ` (${venta.nombre_tipo_cliente})` : ""}
        </p>
        <p>
          <strong>Documento:</strong> {venta.documento_cliente || "—"}
        </p>
        <p>
          <strong>Dirección:</strong> {venta.direccion_cliente || "—"}
        </p>
        <p>
          <strong>Teléfono:</strong> {venta.telefono_cliente || "—"}
        </p>
      </section>

      <table className="comprobante-tabla">
        <thead>
          <tr>
            <th>Código</th>
            <th>Descripción</th>
            <th className="num">Cant.</th>
            <th className="num">Precio unit.</th>
            <th className="num">Desc.</th>
            <th className="num">Importe</th>
          </tr>
        </thead>
        <tbody>
          {detalle.map((d) => (
            <tr key={d.id_detalle ?? d.nro_linea}>
              <td>{d.codigo_producto}</td>
              <td>{d.nombre_completo}</td>
              <td className="num">{Number(d.cantidad)}</td>
              <td className="num">{moneda(d.precio_unitario)}</td>
              <td className="num">{moneda(d.descuento)}</td>
              <td className="num">{moneda(d.importe_linea)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="comprobante-totales">
        <p>
          <span>Subtotal</span>
          <span>{moneda(venta.subtotal)}</span>
        </p>
        <p>
          <span>Descuento{descuentoPct > 0 ? ` (${descuentoPct}%)` : ""}</span>
          <span>{moneda(venta.descuento_total)}</span>
        </p>
        <p className="comprobante-total">
          <span>Total</span>
          <span>{moneda(venta.importe_total)}</span>
        </p>
        {saldo > 0 ? (
          <p>
            <span>Saldo pendiente</span>
            <span>{moneda(saldo)}</span>
          </p>
        ) : null}
      </section>

      {medios.length ? (
        <section className="comprobante-bloque">
          <p>
            <strong>Forma de pago</strong>
          </p>
          <ul>
            {medios.map((m, i) => (
              <li key={m.id ?? m.id_movimiento_caja ?? i}>
                <span>
                  {m.nombre_medio_pago}
                  {m.nombre_cuenta ? ` · ${m.nombre_cuenta}` : ""}
                  {m.referencia ? ` · Ref. ${m.referencia}` : ""}
                </span>
                <span>{moneda(m.importe)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {venta.observaciones ? (
        <section className="comprobante-bloque">
          <p>
            <strong>Observaciones:</strong> {venta.observaciones}
          </p>
        </section>
      ) : null}

      <footer className="comprobante-pie">Documento no válido como factura.</footer>
    </main>
  );
}
