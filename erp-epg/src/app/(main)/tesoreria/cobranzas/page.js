import { listarClientes } from "@/lib/clientes/actions";
import { listarCobros } from "@/lib/cobros/actions";
import { CobrosTable } from "@/components/cobros/CobrosTable";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Cobranzas | Palacio · ERP",
};

/**
 * @param {{ searchParams: Promise<{ cliente?: string, desde?: string, hasta?: string }> }} props
 */
export default async function CobranzasPage({ searchParams }) {
  const sp = await searchParams;
  const filtros = {
    idCliente: sp?.cliente || null,
    desde: sp?.desde || null,
    hasta: sp?.hasta || null,
  };

  const [{ data, error }, clientesRes] = await Promise.all([
    listarCobros(filtros),
    listarClientes(true),
  ]);

  const clientes = (clientesRes.data ?? [])
    .filter((c) => !c.es_consumidor_final && c.lista_precio === "Mayorista")
    .map((c) => ({ id_cliente: c.id_cliente, nombre_cliente: c.nombre_cliente }));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[{ label: "Tesorería" }, { label: "Cobranzas" }]}
        title="Cobranzas"
        description="Cobros de ventas mayoristas: generan ingresos en las cuentas de tesorería y dejan la venta pagada."
      />

      {error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudieron cargar los cobros</p>
          <p className="mt-1 text-amber-900/80">{error}</p>
        </div>
      ) : (
        <CobrosTable
          cobros={data ?? []}
          clientes={clientes}
          filtros={{
            cliente: filtros.idCliente ?? "",
            desde: filtros.desde ?? "",
            hasta: filtros.hasta ?? "",
          }}
        />
      )}
    </div>
  );
}
