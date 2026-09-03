import { PlaceholderModule } from "@/components/layout/PlaceholderModule";

export const metadata = {
  title: "Cuentas | Palacio · ERP",
};

export default function CuentasTesoreriaPage() {
  return (
    <PlaceholderModule
      crumbs={[{ label: "Tesorería" }, { label: "Cuentas" }]}
      title="Cuentas"
      description="Alta y administración de cuentas de tesorería"
      hu="T-01"
    />
  );
}
