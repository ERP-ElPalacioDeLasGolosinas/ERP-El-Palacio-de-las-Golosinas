import { PlaceholderModule } from "@/components/layout/PlaceholderModule";

export const metadata = {
  title: "Categorías | Palacio · ERP",
};

export default function CategoriasPage() {
  return (
    <PlaceholderModule
      crumbs={[{ label: "Categorías" }]}
      title="Categorías"
      description="Gestión de categorías del catálogo. Pendiente de implementación (A-04)."
    />
  );
}
