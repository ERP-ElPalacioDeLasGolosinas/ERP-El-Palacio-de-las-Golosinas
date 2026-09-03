import { PlaceholderModule } from "@/components/layout/PlaceholderModule";

export const metadata = {
  title: "Órdenes de pago | Palacio · ERP",
};

export default function OrdenesDePagoPage() {
  return (
    <PlaceholderModule
      crumbs={[{ label: "Tesorería" }, { label: "Órdenes de pago" }]}
      title="Órdenes de pago"
      description="Registrar orden de pago a proveedor"
      hu="C-07"
    />
  );
}
