import {
  listarComprobantes,
  obtenerResumenComprobantes,
} from "@/lib/comprobantes/actions";
import { listarProveedores } from "@/lib/proveedores/actions";
import { listarTiposComprobante } from "@/lib/tipos-comprobante/actions";
import { ComprobantesTable } from "@/components/comprobantes/ComprobantesTable";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Comprobantes | Palacio · ERP",
};

/**
 * @param {{ searchParams: Promise<{ proveedor?: string, estado?: string, desde?: string, hasta?: string, tipo?: string }> }} props
 */
export default async function ComprobantesPage({ searchParams }) {
  const sp = await searchParams;
  const filtros = {
    idProveedor: sp?.proveedor || null,
    estado: sp?.estado || null,
    desde: sp?.desde || null,
    hasta: sp?.hasta || null,
    idTipoComprobante: sp?.tipo || null,
  };

  const [
    { data, error },
    { data: resumen },
    { data: proveedores },
    { data: tipos },
  ] = await Promise.all([
    listarComprobantes(filtros),
    obtenerResumenComprobantes(filtros),
    listarProveedores(true),
    listarTiposComprobante(false),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[{ label: "Compras" }, { label: "Comprobantes" }]}
        title="Comprobantes de proveedor"
        description="Historial de comprobantes registrados, con su saldo pendiente."
      />

      {error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudieron cargar los comprobantes</p>
          <p className="mt-1 text-amber-900/80">{error}</p>
        </div>
      ) : (
        <ComprobantesTable
          comprobantes={data ?? []}
          resumen={resumen}
          proveedores={proveedores ?? []}
          tipos={tipos ?? []}
          filtros={{
            proveedor: filtros.idProveedor ?? "",
            estado: filtros.estado ?? "",
            desde: filtros.desde ?? "",
            hasta: filtros.hasta ?? "",
            tipo: filtros.idTipoComprobante ?? "",
          }}
        />
      )}
    </div>
  );
}
