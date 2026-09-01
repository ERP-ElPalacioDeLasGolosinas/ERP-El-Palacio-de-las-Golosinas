import { listarDepositos } from "@/lib/depositos/actions";
import { LoteForm } from "@/components/stock/LoteForm";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Registrar lote | Palacio · ERP",
};

export default async function NuevoLotePage() {
  const depositosRes = await listarDepositos(false);

  const depositos = (depositosRes.data ?? []).map((d) => ({
    id_deposito: d.id_deposito,
    nombre_deposito: d.nombre_deposito,
  }));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[
          { label: "Inventario" },
          { label: "Stock", href: "/inventario/stock" },
          { label: "Lotes", href: "/inventario/stock/lotes" },
          { label: "Registrar" },
        ]}
        title="Registrar lote"
        description="Datos generales del lote una vez y varios productos a la vez. Impacta el stock (ingreso por compra) al confirmar."
      />

      <LoteForm depositos={depositos} />
    </div>
  );
}
