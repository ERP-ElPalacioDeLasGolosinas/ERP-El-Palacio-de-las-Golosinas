import { PageHeader } from "@/components/layout/PageHeader";
import { OrdenesCompraTable } from "@/components/ordenes-compra/OrdenesCompraTable";
import { listarOrdenes } from "@/lib/ordenes-compra/actions";
import { ESTADOS_ORDEN } from "@/lib/ordenes-compra/estado";
import { listarProveedores } from "@/lib/proveedores/actions";

export const metadata = { title: "Órdenes de compra | Palacio · ERP" };

/**
 * @param {{ searchParams: Promise<{ proveedor?: string, estado?: string, desde?: string, hasta?: string }> }} props
 */
export default async function OrdenesPage({ searchParams }) {
  const sp = await searchParams;
  const proveedor = sp.proveedor || "";
  const estado = ESTADOS_ORDEN.includes(sp.estado) ? sp.estado : "";
  const desde = sp.desde || "";
  const hasta = sp.hasta || "";

  const [ordenesRes, proveedoresRes] = await Promise.all([
    listarOrdenes({
      idProveedor: proveedor || null,
      estado: estado || null,
      desde: desde || null,
      hasta: hasta || null,
    }),
    listarProveedores(false),
  ]);

  const proveedores = (proveedoresRes.data ?? [])
    .filter((p) => p.activo)
    .map((p) => ({
      id_proveedor: p.id_proveedor,
      nombre_proveedor: p.nombre_proveedor,
    }));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[{ label: "Compras" }, { label: "Órdenes de compra" }]}
        title="Órdenes de compra"
        description="Pedidos a proveedores. La mercadería se recibe contra la factura vinculada a la orden."
      />

      {ordenesRes.error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudieron cargar las órdenes</p>
          <p className="mt-1 text-amber-900/80">{ordenesRes.error}</p>
        </div>
      ) : (
        <OrdenesCompraTable
          ordenes={ordenesRes.data ?? []}
          proveedores={proveedores}
          filtros={{ proveedor, estado, desde, hasta }}
        />
      )}
    </div>
  );
}
