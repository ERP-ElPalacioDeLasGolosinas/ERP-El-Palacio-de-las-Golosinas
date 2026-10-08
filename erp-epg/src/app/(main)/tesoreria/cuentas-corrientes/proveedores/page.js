import { listarCuentasProveedores } from "@/lib/cuentas-corrientes/actions";
import { CuentasCorrientesTable } from "@/components/cuentas-corrientes/CuentasCorrientesTable";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Cuentas corrientes de proveedores | Palacio · ERP",
};

export default async function CuentasProveedoresPage() {
  const { data, error } = await listarCuentasProveedores();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[
          { label: "Tesorería" },
          { label: "Cuentas corrientes" },
          { label: "Proveedores" },
        ]}
        title="Cuentas corrientes de proveedores"
        description="Saldo a favor o en contra de cada proveedor, según facturas, notas de débito, notas de crédito y pagos."
      />

      {error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudieron cargar las cuentas</p>
          <p className="mt-1 text-amber-900/80">{error}</p>
        </div>
      ) : (
        <CuentasCorrientesTable
          lado="proveedor"
          basePath="/tesoreria/cuentas-corrientes/proveedores"
          cuentas={(data ?? []).map((c) => ({
            id: c.id_proveedor,
            nombre: c.nombre_proveedor,
            activo: c.activo,
            saldo: Number(c.saldo) || 0,
            cantidad_movimientos: Number(c.cantidad_movimientos) || 0,
          }))}
        />
      )}
    </div>
  );
}
