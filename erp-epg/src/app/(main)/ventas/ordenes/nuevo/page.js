import { PlaceholderModule } from "@/components/layout/PlaceholderModule";

export const metadata = {
  title: "Registrar venta | Palacio · ERP",
};

export default function RegistrarVentaPage() {
  return (
    <PlaceholderModule
      crumbs={[
        { label: "Ventas" },
        { label: "Ventas", href: "/ventas/ordenes" },
        { label: "Registrar venta" },
      ]}
      title="Registrar venta"
      description="Registro de venta presencial, con medios de pago"
      hu="V-10"
    />
  );
}
