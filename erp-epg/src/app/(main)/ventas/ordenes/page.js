import { listarClientes } from "@/lib/clientes/actions";
import { listarVentas } from "@/lib/ventas/actions";
import { ESTADOS_VENTA, TIPOS_VENTA } from "@/lib/ventas/estado";
import { VentasTable } from "@/components/ventas/VentasTable";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Historial de ventas | Palacio · ERP",
};

/**
 * @param {{ searchParams: Promise<{ cliente?: string, desde?: string, hasta?: string, estado?: string, tipo?: string }> }} props
 */
export default async function HistorialVentasPage({ searchParams }) {
  const sp = await searchParams;
  const filtros = {
    idCliente: sp?.cliente || null,
    desde: sp?.desde || null,
    hasta: sp?.hasta || null,
    estado: ESTADOS_VENTA.includes(sp?.estado) ? sp.estado : null,
    tipoVenta: TIPOS_VENTA.includes(sp?.tipo) ? sp.tipo : null,
  };

  const [{ data, error }, clientesRes] = await Promise.all([
    listarVentas(filtros),
    listarClientes(true),
  ]);

  const clientes = (clientesRes.data ?? [])
    .filter((c) => !c.es_consumidor_final && c.lista_precio === "Mayorista")
    .map((c) => ({ id_cliente: c.id_cliente, nombre_cliente: c.nombre_cliente }));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[
          { label: "Ventas" },
          { label: "Ventas", href: "/ventas/ordenes" },
          { label: "Historial" },
        ]}
        title="Historial de ventas"
        description="Las mayoristas pasan de “En preparación” a “Despachado” desde el detalle y a “Pagado” al cobrarlas en Tesorería. Las minoristas y a consumidor final se cobran en caja y nacen “Pagado”."
      />

      {error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudieron cargar las ventas</p>
          <p className="mt-1 text-amber-900/80">{error}</p>
        </div>
      ) : (
        <VentasTable
          ventas={data ?? []}
          clientes={clientes}
          filtros={{
            cliente: filtros.idCliente ?? "",
            desde: filtros.desde ?? "",
            hasta: filtros.hasta ?? "",
            estado: filtros.estado ?? "",
            tipo: filtros.tipoVenta ?? "",
          }}
        />
      )}
    </div>
  );
}
