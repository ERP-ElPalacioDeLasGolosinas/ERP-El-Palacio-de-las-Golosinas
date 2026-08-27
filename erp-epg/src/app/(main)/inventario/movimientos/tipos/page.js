import { PlaceholderModule } from "@/components/layout/PlaceholderModule";

export const metadata = {
  title: "Tipos de movimiento | Palacio · ERP",
};

export default function TiposMovimientoPage() {
  return (
    <PlaceholderModule
      crumbs={[
        { label: "Movimientos", href: "/inventario/movimientos" },
        { label: "Tipos" },
      ]}
      title="Tipos de movimiento"
      description="Gestión de tipos de movimiento de stock. Pendiente de implementación (S-04)."
    />
  );
}
