import { listarClientes } from "@/lib/clientes/actions";
import { listarDepositos } from "@/lib/depositos/actions";
import { listarProductos } from "@/lib/productos/actions";
import { listarTiposComprobanteVenta } from "@/lib/ventas/actions";
import { VentaForm } from "@/components/ventas/VentaForm";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Registrar venta | Palacio · ERP",
};

export default async function RegistrarVentaPage() {
  const [clientesRes, tiposRes, depositosRes, productosRes] = await Promise.all([
    listarClientes(false),
    listarTiposComprobanteVenta(),
    listarDepositos(false),
    listarProductos(false),
  ]);

  const error =
    clientesRes.error || tiposRes.error || depositosRes.error || productosRes.error;

  const clientes = (clientesRes.data ?? [])
    .filter((c) => c.activo && !c.es_consumidor_final && c.lista_precio === "Mayorista")
    .map((c) => ({
      id_cliente: c.id_cliente,
      nombre_cliente: c.nombre_cliente,
      documento_cliente: c.documento_cliente,
    }));

  const tipos = (tiposRes.data ?? []).map((t) => ({
    id_tipo_comprobante: t.id_tipo_comprobante,
    nombre_tipo_comprobante: t.nombre_tipo_comprobante,
    letra: t.letra,
  }));

  const depositos = (depositosRes.data ?? [])
    .filter((d) => d.activo)
    .map((d) => ({ id_deposito: d.id_deposito, nombre_deposito: d.nombre_deposito }));

  const precios = Object.fromEntries(
    (productosRes.data ?? []).map((p) => [p.id_producto, Number(p.precio_mayorista_producto) || 0])
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[
          { label: "Ventas" },
          { label: "Ventas mayoristas", href: "/ventas/ordenes" },
          { label: "Registrar venta" },
        ]}
        title="Registrar venta"
        description="La venta se emite con su comprobante y descuenta el stock al confirmarla. El cobro se registra después, en Tesorería, una vez despachada."
      />

      {error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudieron cargar los datos del formulario</p>
          <p className="mt-1 text-amber-900/80">{error}</p>
        </div>
      ) : (
        <VentaForm clientes={clientes} tipos={tipos} depositos={depositos} precios={precios} />
      )}
    </div>
  );
}
