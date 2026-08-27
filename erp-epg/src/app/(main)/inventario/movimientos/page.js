import { PlaceholderModule } from "@/components/layout/PlaceholderModule";

export const metadata = {
  title: "Movimientos de stock | Palacio · ERP",
};

export default function MovimientosPage() {
  return (
    <PlaceholderModule
      crumbs={[{ label: "Movimientos" }, { label: "Historial" }]}
      title="Historial de movimientos"
      description="Auditoría de movimientos de stock. Pendiente de implementación (S-05)."
    />
  );
}
