import Link from "next/link";
import { listarClientes } from "@/lib/clientes/actions";
import { listarMediosPago } from "@/lib/medios-pago/actions";
import { listarVentas, obtenerVenta } from "@/lib/ventas/actions";
import { CobroForm } from "@/components/cobros/CobroForm";
import { VentasTable } from "@/components/ventas/VentasTable";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Registrar cobro | Palacio · ERP",
};

const crumbs = [
  { label: "Tesorería" },
  { label: "Cobranzas", href: "/tesoreria/cobranzas" },
  { label: "Registrar" },
];

/**
 * @param {{ searchParams: Promise<{ venta?: string, cliente?: string, desde?: string, hasta?: string }> }} props
 */
export default async function NuevoCobroPage({ searchParams }) {
  const sp = await searchParams;
  const idVenta = sp?.venta || null;

  if (!idVenta) {
    const filtros = {
      idCliente: sp?.cliente || null,
      desde: sp?.desde || null,
      hasta: sp?.hasta || null,
    };
    const [{ data, error }, clientesRes] = await Promise.all([
      listarVentas({ ...filtros, estado: "Despachado" }),
      listarClientes(true),
    ]);
    const clientes = (clientesRes.data ?? [])
      .filter((c) => !c.es_consumidor_final && c.lista_precio === "Mayorista")
      .map((c) => ({ id_cliente: c.id_cliente, nombre_cliente: c.nombre_cliente }));

    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
        <PageHeader
          crumbs={crumbs}
          title="Registrar cobro"
          description="Ventas mayoristas despachadas pendientes de cobro. El cobro tiene que cubrir el total de la venta."
        />
        {error ? (
          <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
            <p className="font-medium">No se pudieron cargar las ventas</p>
            <p className="mt-1 text-amber-900/80">{error}</p>
          </div>
        ) : (
          <VentasTable
            modo="cobro"
            ventas={data ?? []}
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

  const [{ data, error }, mediosRes] = await Promise.all([
    obtenerVenta(idVenta),
    listarMediosPago(false),
  ]);

  const venta = data?.venta;
  if (error || !venta || venta.estado !== "Despachado") {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8">
        <PageHeader crumbs={crumbs} title="Registrar cobro" />
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">La venta no admite cobro</p>
          <p className="mt-1 text-amber-900/80">
            {error ??
              (venta
                ? `La venta está en estado “${venta.estado}”. Solo se puede cobrar una venta despachada.`
                : "La venta no existe.")}
          </p>
          <Link
            href={venta ? `/ventas/ordenes/${idVenta}` : "/tesoreria/cobranzas/nuevo"}
            className="palacio-btn-secondary mt-3 inline-flex px-4 py-2.5 text-sm"
          >
            Volver
          </Link>
        </div>
      </div>
    );
  }

  const medios = (mediosRes.data ?? [])
    .filter((m) => m.activo && m.tipo !== "Cheque propio")
    .map((m) => ({
      id_medio_pago: m.id_medio_pago,
      nombre_medio_pago: m.nombre_medio_pago,
      tipo: m.tipo,
      requiere_referencia: Boolean(m.requiere_referencia),
    }));

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[...crumbs.slice(0, 2), { label: venta.nombre_cliente ?? "Registrar" }]}
        title="Registrar cobro"
        description="Cada medio se imputa a una cuenta de tesorería. Al confirmar, la venta pasa a “Pagado”."
      />
      <CobroForm
        venta={{
          id_comprobante: venta.id_comprobante,
          nombre_cliente: venta.nombre_cliente,
          nombre_tipo_comprobante: venta.nombre_tipo_comprobante,
          numero_formateado: venta.numero_formateado,
          importe_total: Number(venta.saldo_pendiente) || 0,
        }}
        medios={medios}
      />
    </div>
  );
}
