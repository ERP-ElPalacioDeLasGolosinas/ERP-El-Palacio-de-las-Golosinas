import { listarProveedores } from "@/lib/proveedores/actions";
import { listarTiposComprobante } from "@/lib/tipos-comprobante/actions";
import { listarProductos } from "@/lib/productos/actions";
import { listarComprobantes } from "@/lib/comprobantes/actions";
import { listarOrdenes } from "@/lib/ordenes-compra/actions";
import { ComprobanteForm } from "@/components/comprobantes/ComprobanteForm";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Registrar comprobante | Palacio · ERP",
};

export default async function RegistrarComprobantePage() {
  const [proveedoresRes, tiposRes, productosRes, comprobantesRes, ordenesRes] =
    await Promise.all([
      listarProveedores(false),
      listarTiposComprobante(false),
      listarProductos(false),
      listarComprobantes(),
      listarOrdenes(),
    ]);

  const proveedores = (proveedoresRes.data ?? [])
    .filter((p) => p.activo)
    .map((p) => ({
      id_proveedor: p.id_proveedor,
      nombre_proveedor: p.nombre_proveedor,
    }));

  const tipos = (tiposRes.data ?? []).map((t) => ({
    id_tipo_comprobante: t.id_tipo_comprobante,
    nombre_tipo_comprobante: t.nombre_tipo_comprobante,
    letra: t.letra ?? null,
    clase: t.clase ?? "factura",
  }));

  const productos = (productosRes.data ?? [])
    .filter((p) => p.activo)
    .map((p) => ({
      id_producto: p.id_producto,
      nombre_completo: p.nombre_completo,
      codigo_producto: p.codigo_producto ?? null,
    }));

  // Facturas no anuladas para el selector de "comprobante asociado" de
  // notas de débito / crédito / remitos (se filtra por proveedor en el
  // cliente).
  const ordenes = (ordenesRes.data ?? [])
    .filter((o) => o.estado === "Pendiente")
    .map((o) => ({
      id_orden_compra: o.id_orden_compra,
      id_proveedor: o.id_proveedor,
      numero_formateado: o.numero_formateado,
      estado: o.estado,
    }));

  const facturas = (comprobantesRes.data ?? [])
    .filter((c) => c.clase === "factura" && !c.anulado)
    .map((c) => ({
      id_comprobante: c.id_comprobante,
      id_proveedor: c.id_proveedor,
      numero_formateado: c.numero_formateado,
      nombre_tipo_comprobante: c.nombre_tipo_comprobante,
      letra: c.letra ?? null,
    }));

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[
          { label: "Compras" },
          { label: "Comprobantes", href: "/compras/comprobantes" },
          { label: "Registrar" },
        ]}
        title="Registrar comprobante"
        description="Alta de un documento de proveedor (factura / nota de débito / nota de crédito / remito). El formulario se adapta al tipo elegido."
      />

      <ComprobanteForm
        proveedores={proveedores}
        tipos={tipos}
        productos={productos}
        facturas={facturas}
        ordenes={ordenes}
      />
    </div>
  );
}
