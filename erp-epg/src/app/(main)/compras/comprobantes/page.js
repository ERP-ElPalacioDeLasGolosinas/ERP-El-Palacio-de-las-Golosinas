import { PlaceholderModule } from "@/components/layout/PlaceholderModule";

export const metadata = {
  title: "Comprobantes | Palacio · ERP",
};

export default function ComprobantesHistorialPage() {
  return (
    <PlaceholderModule
      crumbs={[
        { label: "Compras" },
        { label: "Comprobantes" },
        { label: "Historial" },
      ]}
      title="Historial de comprobantes"
      description="Consultar comprobantes pendientes de pago por proveedor"
      hu="C-12"
    />
  );
}
