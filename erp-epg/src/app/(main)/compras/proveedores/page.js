import { PlaceholderModule } from "@/components/layout/PlaceholderModule";

export const metadata = {
  title: "Proveedores | Palacio · ERP",
};

export default function ProveedoresPage() {
  return (
    <PlaceholderModule
      crumbs={[{ label: "Compras" }, { label: "Proveedores" }]}
      title="Proveedores"
      description="Alta, edición y administración de proveedores"
      hu="C-01"
    />
  );
}
