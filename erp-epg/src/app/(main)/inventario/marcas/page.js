import { PlaceholderModule } from "@/components/layout/PlaceholderModule";

export const metadata = {
  title: "Marcas | Palacio · ERP",
};

export default function MarcasPage() {
  return (
    <PlaceholderModule
      crumbs={[{ label: "Marcas" }]}
      title="Marcas"
      description="Gestión de marcas del catálogo. Pendiente de implementación (A-02)."
    />
  );
}
