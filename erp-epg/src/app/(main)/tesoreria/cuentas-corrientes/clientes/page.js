import { listarCuentasClientes } from "@/lib/cuentas-corrientes/actions";
import { CuentasCorrientesTable } from "@/components/cuentas-corrientes/CuentasCorrientesTable";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Cuentas corrientes de clientes | Palacio · ERP",
};

export default async function CuentasClientesPage() {
  const { data, error } = await listarCuentasClientes();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[
          { label: "Tesorería" },
          { label: "Cuentas corrientes" },
          { label: "Clientes" },
        ]}
        title="Cuentas corrientes de clientes"
        description="Saldo a favor o en contra de cada cliente mayorista, según sus ventas y cobros."
      />

      {error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudieron cargar las cuentas</p>
          <p className="mt-1 text-amber-900/80">{error}</p>
        </div>
      ) : (
        <CuentasCorrientesTable
          lado="cliente"
          basePath="/tesoreria/cuentas-corrientes/clientes"
          cuentas={(data ?? []).map((c) => ({
            id: c.id_cliente,
            nombre: c.nombre_cliente,
            activo: c.activo,
            saldo: Number(c.saldo) || 0,
            cantidad_movimientos: Number(c.cantidad_movimientos) || 0,
          }))}
        />
      )}
    </div>
  );
}
