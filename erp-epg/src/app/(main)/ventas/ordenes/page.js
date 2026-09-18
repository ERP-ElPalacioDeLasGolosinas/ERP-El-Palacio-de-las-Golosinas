import { PlaceholderModule } from "@/components/layout/PlaceholderModule";

export const metadata = {
  title: "Historial de ventas | Palacio · ERP",
};

export default function HistorialVentasPage() {
  return (
    <PlaceholderModule
      crumbs={[
        { label: "Ventas" },
        { label: "Ventas", href: "/ventas/ordenes" },
        { label: "Historial" },
      ]}
      title="Historial de ventas"
      description="Consulta de órdenes de venta registradas"
      hu="V-19"
    />
  );
}
