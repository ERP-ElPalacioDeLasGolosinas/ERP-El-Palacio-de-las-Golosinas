import Link from "next/link";
import { notFound } from "next/navigation";
import {
  listarCuentasClientes,
  listarMovimientosCliente,
} from "@/lib/cuentas-corrientes/actions";
import { MovimientosCuenta } from "@/components/cuentas-corrientes/MovimientosCuenta";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Cuenta corriente del cliente | Palacio · ERP",
};

/**
 * @param {{ params: Promise<{ id: string }>, searchParams: Promise<{ desde?: string, hasta?: string }> }} props
 */
export default async function CuentaClientePage({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const filtros = { desde: sp?.desde || null, hasta: sp?.hasta || null };

  const [cuentasRes, movsRes] = await Promise.all([
    listarCuentasClientes(),
    listarMovimientosCliente(id, filtros),
  ]);

  const cuenta = (cuentasRes.data ?? []).find((c) => c.id_cliente === id);
  if (!cuenta && !cuentasRes.error) notFound();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[
          { label: "Tesorería" },
          { label: "Cuentas corrientes", href: "/tesoreria/cuentas-corrientes/clientes" },
          { label: "Clientes", href: "/tesoreria/cuentas-corrientes/clientes" },
          { label: cuenta?.nombre_cliente ?? "Cliente" },
        ]}
        title={cuenta?.nombre_cliente ?? "Cuenta corriente"}
        description="Las ventas mayoristas aumentan lo que nos debe. Los cobros lo cancelan."
        actions={
          <Link href="/tesoreria/cuentas-corrientes/clientes" className="palacio-btn-secondary px-4 py-2 text-sm">
            Volver
          </Link>
        }
      />

      {cuentasRes.error || movsRes.error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudo cargar la cuenta</p>
          <p className="mt-1 text-amber-900/80">{cuentasRes.error || movsRes.error}</p>
        </div>
      ) : (
        <MovimientosCuenta
          lado="cliente"
          saldo={Number(cuenta.saldo) || 0}
          movimientos={movsRes.data ?? []}
          filtros={{ desde: filtros.desde ?? "", hasta: filtros.hasta ?? "" }}
          hayMovimientos={Number(cuenta.cantidad_movimientos) > 0}
        />
      )}
    </div>
  );
}
