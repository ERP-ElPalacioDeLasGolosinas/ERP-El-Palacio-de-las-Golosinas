import { PlaceholderModule } from "@/components/layout/PlaceholderModule";

export const metadata = {
  title: "Registrar movimiento | Palacio · ERP",
};

export default function NuevoMovimientoPage() {
  return (
    <PlaceholderModule
      crumbs={[
        { label: "Movimientos", href: "/inventario/movimientos" },
        { label: "Registrar" },
      ]}
      title="Registrar movimiento"
      description="Alta de un movimiento de stock. Pendiente de implementación (S-05)."
    />
  );
}
