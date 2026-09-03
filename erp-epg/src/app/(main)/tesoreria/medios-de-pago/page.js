import { PlaceholderModule } from "@/components/layout/PlaceholderModule";

export const metadata = {
  title: "Medios de pago | Palacio · ERP",
};

export default function MediosDePagoPage() {
  return (
    <PlaceholderModule
      crumbs={[{ label: "Tesorería" }, { label: "Medios de pago" }]}
      title="Medios de pago"
      description="Alta, edición y administración de medios de pago en tesorería"
      hu="T-02"
    />
  );
}
