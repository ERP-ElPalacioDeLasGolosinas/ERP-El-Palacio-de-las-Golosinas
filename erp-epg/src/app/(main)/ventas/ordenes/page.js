import { PlaceholderModule } from "@/components/layout/PlaceholderModule";

export const metadata = {
  title: "Historial de ventas | Palacio · ERP",
};

export default function HistorialVentasPage() {
  return (
    <PlaceholderModule
      crumbs={[
        { label: "Ventas" },
        { label: "Ventas mayoristas", href: "/ventas/ordenes" },
        { label: "Historial" },
      ]}
      title="Historial de ventas"
      description="Consulta de ventas mayoristas registradas"
      hu="V-19"
    />
  );
}
