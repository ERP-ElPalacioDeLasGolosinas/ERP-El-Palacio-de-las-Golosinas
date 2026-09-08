import { listarPagos } from "@/lib/pagos/actions";
import { listarProveedores } from "@/lib/proveedores/actions";
import { PagosTable } from "@/components/pagos/PagosTable";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Historial de pagos | Palacio · ERP",
};

/**
 * @param {{ searchParams: Promise<{ proveedor?: string, desde?: string, hasta?: string }> }} props
 */
export default async function PagosPage({ searchParams }) {
  const sp = await searchParams;
  const filtros = {
    idProveedor: sp?.proveedor || null,
    desde: sp?.desde || null,
    hasta: sp?.hasta || null,
  };

  const [{ data, error }, { data: proveedores }] = await Promise.all([
    listarPagos(filtros),
    listarProveedores(true),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[{ label: "Tesorería" }, { label: "Pagos" }]}
        title="Historial de pagos"
        description="Pagos registrados desde órdenes de pago: generan movimientos de tesorería y bajan el saldo de los comprobantes."
      />

      {error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudieron cargar los pagos</p>
          <p className="mt-1 text-amber-900/80">{error}</p>
        </div>
      ) : (
        <PagosTable
          pagos={data ?? []}
          proveedores={proveedores ?? []}
          filtros={{
            proveedor: filtros.idProveedor ?? "",
            desde: filtros.desde ?? "",
            hasta: filtros.hasta ?? "",
          }}
        />
      )}
    </div>
  );
}
