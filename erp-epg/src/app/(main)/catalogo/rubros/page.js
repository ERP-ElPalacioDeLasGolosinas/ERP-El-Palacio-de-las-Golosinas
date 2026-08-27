import { PlaceholderModule } from "@/components/layout/PlaceholderModule";

export const metadata = {
  title: "Rubros | Palacio · ERP",
};

export default function RubrosPage() {
  return (
    <PlaceholderModule
      crumbs={[{ label: "Rubros" }]}
      title="Rubros"
      description="Gestión de rubros del catálogo. Pendiente de implementación (A-03)."
    />
  );
}
