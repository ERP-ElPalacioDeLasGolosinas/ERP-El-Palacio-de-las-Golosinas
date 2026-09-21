import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Cajas | Palacio · ERP",
};

export default function CajasPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader crumbs={[{ label: "Ventas" }, { label: "Cajas" }]} title="Cajas" />
    </div>
  );
}
