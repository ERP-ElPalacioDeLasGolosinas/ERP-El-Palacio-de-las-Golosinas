import { listarCajas } from "@/lib/cajas/actions";
import { listarDepositos } from "@/lib/depositos/actions";
import { CajasTable } from "@/components/cajas/CajasTable";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Historial de cajas | Palacio · ERP",
};

/**
 * @param {{ searchParams: Promise<{ desde?: string, hasta?: string, estado?: string, deposito?: string, empleado?: string, empleadoNombre?: string }> }} props
 */
export default async function HistorialCajasPage({ searchParams }) {
  const sp = await searchParams;
  const filtros = {
    desde: sp?.desde || null,
    hasta: sp?.hasta || null,
    estado: sp?.estado || null,
    idDeposito: sp?.deposito || null,
    idEmpleado: sp?.empleado || null,
  };

  const [{ data, error }, depositosRes] = await Promise.all([
    listarCajas(filtros),
    listarDepositos(true),
  ]);
  const depositos = (depositosRes.data ?? []).map((d) => ({
    id_deposito: d.id_deposito,
    nombre_deposito: d.nombre_deposito,
  }));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[{ label: "Ventas" }, { label: "Cajas", href: "/ventas/cajas" }, { label: "Historial" }]}
        title="Historial de cajas"
        description="Aperturas y cierres con sus totales y la diferencia del arqueo de efectivo."
      />

      {error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudieron cargar las cajas</p>
          <p className="mt-1 text-amber-900/80">{error}</p>
        </div>
      ) : (
        <CajasTable
          cajas={data ?? []}
          depositos={depositos}
          filtros={{
            desde: filtros.desde ?? "",
            hasta: filtros.hasta ?? "",
            estado: filtros.estado ?? "",
            deposito: filtros.idDeposito ?? "",
            empleado: filtros.idEmpleado ?? "",
            empleadoNombre: sp?.empleadoNombre ?? "",
          }}
        />
      )}
    </div>
  );
}
