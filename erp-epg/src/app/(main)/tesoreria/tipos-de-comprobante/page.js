import { PlaceholderModule } from "@/components/layout/PlaceholderModule";

export const metadata = {
  title: "Tipos de comprobante | Palacio · ERP",
};

export default function TiposComprobantePage() {
  return (
    <PlaceholderModule
      crumbs={[{ label: "Tesorería" }, { label: "Tipos de comprobante" }]}
      title="Tipos de comprobante"
      description="Alta, edición y administración de tipos de comprobante de proveedor"
      hu="C-06"
    />
  );
}
