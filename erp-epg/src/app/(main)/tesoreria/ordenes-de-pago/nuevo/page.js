import { listarProveedores } from "@/lib/proveedores/actions";
import { listarMediosPago } from "@/lib/medios-pago/actions";
import { OrdenPagoForm } from "@/components/ordenes-pago/OrdenPagoForm";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Nueva orden de pago | Palacio · ERP",
};

export default async function NuevaOrdenPagoPage() {
  const [proveedoresRes, mediosRes] = await Promise.all([
    listarProveedores(false),
    listarMediosPago(false),
  ]);

  const proveedores = (proveedoresRes.data ?? [])
    .filter((p) => p.activo)
    .map((p) => ({
      id_proveedor: p.id_proveedor,
      nombre_proveedor: p.nombre_proveedor,
    }));

  const medios = (mediosRes.data ?? [])
    .filter((m) => m.activo)
    .map((m) => ({
      id_medio_pago: m.id_medio_pago,
      nombre_medio_pago: m.nombre_medio_pago,
      tipo: m.tipo,
      requiere_referencia: Boolean(m.requiere_referencia),
    }));

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[
          { label: "Tesorería" },
          { label: "Pagos", href: "/tesoreria/pagos" },
          { label: "Órdenes de pago", href: "/tesoreria/ordenes-de-pago" },
          { label: "Nueva" },
        ]}
        title="Nueva orden de pago"
        description="Elegí el proveedor, imputá sus comprobantes pendientes y cargá los medios de pago. Podés guardarla como borrador o confirmarla."
      />

      <OrdenPagoForm proveedores={proveedores} medios={medios} />
    </div>
  );
}
