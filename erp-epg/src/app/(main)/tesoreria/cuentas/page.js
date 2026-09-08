import { listarCuentasTesoreria } from "@/lib/cuentas-tesoreria/actions";
import { TIPOS_CUENTA } from "@/lib/cuentas-tesoreria/constantes";
import { CuentasTesoreriaTable } from "@/components/cuentas-tesoreria/CuentasTesoreriaTable";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Cuentas | Palacio · ERP",
};

/**
 * @param {{ searchParams: Promise<{ inactivas?: string, tipo?: string }> }} props
 */
export default async function CuentasTesoreriaPage({ searchParams }) {
  const sp = await searchParams;
  const incluirInactivas = sp?.inactivas === "1";
  const tipo = TIPOS_CUENTA.includes(sp?.tipo) ? sp.tipo : null;

  const { data, error } = await listarCuentasTesoreria(incluirInactivas, tipo);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[{ label: "Tesorería" }, { label: "Cuentas" }]}
        title="Cuentas"
        description="Alta y administración de cuentas de tesorería (Banco, Caja, Valores)."
      />

      {error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudieron cargar las cuentas</p>
          <p className="mt-1 text-amber-900/80">{error}</p>
        </div>
      ) : (
        <CuentasTesoreriaTable
          cuentas={data ?? []}
          incluirInactivas={incluirInactivas}
          tipo={tipo}
        />
      )}
    </div>
  );
}
