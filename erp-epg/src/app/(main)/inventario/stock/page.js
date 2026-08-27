import { PlaceholderModule } from "@/components/layout/PlaceholderModule";

export const metadata = {
  title: "Stock | Palacio · ERP",
};

export default function StockPage() {
  return (
    <PlaceholderModule
      crumbs={[{ label: "Stock" }]}
      title="Consultar stock"
      description="Stock por producto y depósito. Pendiente de implementación (S-03)."
    />
  );
}
