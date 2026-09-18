import { PlaceholderModule } from "@/components/layout/PlaceholderModule";

export const metadata = {
  title: "Comprobantes de venta | Palacio · ERP",
};

export default function HistorialComprobantesVentaPage() {
  return (
    <PlaceholderModule
      crumbs={[
        { label: "Ventas" },
        { label: "Comprobantes", href: "/ventas/comprobantes" },
        { label: "Historial" },
      ]}
      title="Historial de comprobantes"
      description="Consulta de comprobantes de venta emitidos"
      hu="V-11"
    />
  );
}
