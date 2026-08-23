import { PageHeader } from "@/components/layout/PageHeader";

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[{ label: "Inicio" }]}
        title="Inicio"
        description="Seleccioná un módulo del menú para continuar."
      />
    </div>
  );
}
