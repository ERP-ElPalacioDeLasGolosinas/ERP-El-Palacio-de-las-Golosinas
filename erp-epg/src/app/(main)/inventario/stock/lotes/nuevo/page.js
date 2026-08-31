import { listarDepositos } from "@/lib/depositos/actions";
import { listarProductos } from "@/lib/productos/actions";
import { listarProveedoresMin } from "@/lib/stock/actions";
import { LoteForm } from "@/components/stock/LoteForm";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Registrar lote | Palacio · ERP",
};

export default async function NuevoLotePage() {
  const [depositosRes, proveedoresRes, productosRes] = await Promise.all([
    listarDepositos(false),
    listarProveedoresMin(),
    listarProductos(false),
  ]);

  const depositos = (depositosRes.data ?? []).map((d) => ({
    id_deposito: d.id_deposito,
    nombre_deposito: d.nombre_deposito,
  }));
  const proveedores = (proveedoresRes.data ?? []).map((p) => ({
    id_proveedor: p.id_proveedor,
    nombre_proveedor: p.nombre_proveedor,
  }));
  const productos = (productosRes.data ?? []).map((p) => ({
    id_producto: p.id_producto,
    nombre_completo: p.nombre_completo ?? p.nombre_producto,
  }));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[
          { label: "Inventario" },
          { label: "Stock", href: "/inventario/stock" },
          { label: "Lotes", href: "/inventario/stock/lotes" },
          { label: "Registrar" },
        ]}
        title="Registrar lote"
        description="Datos generales del lote una vez y varios productos a la vez. Impacta el stock (ingreso por compra) al confirmar."
      />

      <LoteForm
        depositos={depositos}
        proveedores={proveedores}
        productos={productos}
      />
    </div>
  );
}
