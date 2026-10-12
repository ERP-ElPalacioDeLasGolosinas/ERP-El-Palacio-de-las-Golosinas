import { PageHeader } from "@/components/layout/PageHeader";
import { OrdenForm } from "@/components/ordenes-compra/OrdenForm";
import { listarProveedores } from "@/lib/proveedores/actions";

export const metadata = { title: "Registrar orden de compra | Palacio · ERP" };

export default async function NuevaOrdenPage() {
  const proveedoresRes = await listarProveedores(false);

  const proveedores = (proveedoresRes.data ?? [])
    .filter((p) => p.activo)
    .map((p) => ({
      id_proveedor: p.id_proveedor,
      nombre_proveedor: p.nombre_proveedor,
    }));

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[
          { label: "Compras" },
          { label: "Órdenes de compra", href: "/compras/ordenes" },
          { label: "Registrar" },
        ]}
        title="Registrar orden de compra"
        description="Un proveedor, una fecha y los artículos pedidos. Después la factura del proveedor se vincula a esta orden."
      />
      <OrdenForm proveedores={proveedores} />
    </div>
  );
}
