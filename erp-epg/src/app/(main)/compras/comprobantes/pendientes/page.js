import {
  listarComprobantesPendientes,
  obtenerResumenPendientes,
} from "@/lib/comprobantes/actions";
import { listarProveedores } from "@/lib/proveedores/actions";
import { PendientesPorProveedor } from "@/components/comprobantes/PendientesPorProveedor";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Comprobantes pendientes | Palacio · ERP",
};

/**
 * @param {{ searchParams: Promise<{ proveedor?: string, orden?: string }> }} props
 */
export default async function ComprobantesPendientesPage({ searchParams }) {
  const sp = await searchParams;
  const idProveedor = sp?.proveedor || "";
  const orden = sp?.orden === "vencimiento" ? "vencimiento" : "fecha";

  const [{ data, error }, { data: resumen }, { data: proveedores }] =
    await Promise.all([
      listarComprobantesPendientes(idProveedor, orden),
      obtenerResumenPendientes(idProveedor),
      listarProveedores(true),
    ]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[
          { label: "Compras" },
          { label: "Comprobantes" },
          { label: "Pendientes" },
        ]}
        title="Comprobantes pendientes por proveedor"
        description="Comprobantes con saldo pendiente de un proveedor, ordenados por fecha o vencimiento."
      />

      {error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">
            No se pudieron cargar los comprobantes pendientes
          </p>
          <p className="mt-1 text-amber-900/80">{error}</p>
        </div>
      ) : (
        <PendientesPorProveedor
          comprobantes={data ?? []}
          resumen={resumen}
          proveedores={proveedores ?? []}
          filtros={{ proveedor: idProveedor, orden }}
        />
      )}
    </div>
  );
}
