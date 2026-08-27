import { DepositoForm } from "@/components/depositos/DepositoForm";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Nuevo depósito | Palacio · ERP",
};

export default function NuevoDepositoPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[
          { label: "Depósitos", href: "/inventario/depositos" },
          { label: "Nuevo" },
        ]}
        title="Nuevo depósito"
        description="Completá los datos para registrar un depósito."
      />
      <DepositoForm />
    </div>
  );
}
