import { RubroForm } from "@/components/rubros/RubroForm";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Nuevo rubro | Palacio · ERP",
};

export default function NuevoRubroPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[
          { label: "Inicio", href: "/" },
          { label: "Rubros", href: "/rubros" },
          { label: "Nuevo" },
        ]}
        title="Nuevo rubro"
        description="Completá el nombre para registrar un rubro del catálogo."
      />
      <RubroForm />
    </div>
  );
}
