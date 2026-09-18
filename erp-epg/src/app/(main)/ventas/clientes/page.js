import { listarClientes } from "@/lib/clientes/actions";
import { listarTiposCliente } from "@/lib/tipos-cliente/actions";
import { ClientesTable } from "@/components/clientes/ClientesTable";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Clientes | Palacio · ERP",
};

/**
 * @param {{ searchParams: Promise<{ inactivos?: string }> }} props
 */
export default async function ClientesPage({ searchParams }) {
  const sp = await searchParams;
  const incluirInactivos = sp?.inactivos === "1";

  const [{ data, error }, tiposRes] = await Promise.all([
    listarClientes(incluirInactivos),
    listarTiposCliente(false),
  ]);

  const tiposActivos = (tiposRes.data ?? [])
    .filter((t) => t.activo)
    .map((t) => ({
      id_tipo_cliente: t.id_tipo_cliente,
      nombre_tipo_cliente: t.nombre_tipo_cliente,
      lista_precio: t.lista_precio,
      activo: true,
    }));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[{ label: "Ventas" }, { label: "Clientes" }]}
        title="Clientes"
        description="Alta, edición y administración de la cartera de clientes."
      />

      {error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudieron cargar los clientes</p>
          <p className="mt-1 text-amber-900/80">{error}</p>
        </div>
      ) : (
        <ClientesTable
          clientes={data ?? []}
          tiposActivos={tiposActivos}
          incluirInactivos={incluirInactivos}
        />
      )}
    </div>
  );
}
