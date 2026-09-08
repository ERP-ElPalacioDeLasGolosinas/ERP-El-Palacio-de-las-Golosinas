import { listarOrdenesPago } from "@/lib/ordenes-pago/actions";
import { listarProveedores } from "@/lib/proveedores/actions";
import { OrdenesPagoTable } from "@/components/ordenes-pago/OrdenesPagoTable";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Órdenes de pago | Palacio · ERP",
};

/**
 * @param {{ searchParams: Promise<{ proveedor?: string, estado?: string, desde?: string, hasta?: string }> }} props
 */
export default async function OrdenesDePagoPage({ searchParams }) {
  const sp = await searchParams;
  const filtros = {
    idProveedor: sp?.proveedor || null,
    estado: sp?.estado || null,
    desde: sp?.desde || null,
    hasta: sp?.hasta || null,
  };

  const [{ data, error }, { data: proveedores }] = await Promise.all([
    listarOrdenesPago(filtros),
    listarProveedores(true),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[
          { label: "Tesorería" },
          { label: "Pagos", href: "/tesoreria/pagos" },
          { label: "Órdenes de pago" },
        ]}
        title="Órdenes de pago a proveedor"
        description="Órdenes que instruyen cancelar comprobantes de un proveedor con uno o más medios de pago."
      />

      {error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudieron cargar las órdenes de pago</p>
          <p className="mt-1 text-amber-900/80">{error}</p>
        </div>
      ) : (
        <OrdenesPagoTable
          ordenes={data ?? []}
          proveedores={proveedores ?? []}
          filtros={{
            proveedor: filtros.idProveedor ?? "",
            estado: filtros.estado ?? "",
            desde: filtros.desde ?? "",
            hasta: filtros.hasta ?? "",
          }}
        />
      )}
    </div>
  );
}
