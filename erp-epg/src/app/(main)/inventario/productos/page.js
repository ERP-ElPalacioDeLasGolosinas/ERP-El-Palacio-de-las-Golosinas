import { PlaceholderModule } from "@/components/layout/PlaceholderModule";

export const metadata = {
  title: "Productos | Palacio · ERP",
};

export default function ProductosPage() {
  return (
    <PlaceholderModule
      crumbs={[{ label: "Productos" }]}
      title="Productos"
      description="Catálogo de productos. Pendiente de implementación (A-05)."
    />
  );
}
