import Link from "next/link";
import { obtenerOrdenPago } from "@/lib/ordenes-pago/actions";
import { listarMediosPago } from "@/lib/medios-pago/actions";
import { PagoForm } from "@/components/pagos/PagoForm";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Registrar pago | Palacio · ERP",
};

const ESTADOS_PAGABLES = new Set(["Pendiente de pago", "Pagada parcial"]);

/**
 * @param {{ searchParams: Promise<{ orden?: string }> }} props
 */
export default async function NuevoPagoPage({ searchParams }) {
  const sp = await searchParams;
  const idOrden = sp?.orden || null;

  const header = (
    <PageHeader
      crumbs={[
        { label: "Tesorería" },
        { label: "Pagos", href: "/tesoreria/pagos" },
        { label: "Registrar" },
      ]}
      title="Registrar pago"
      description="El pago se registra siempre desde una orden de pago pendiente."
    />
  );

  if (!idOrden) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8">
        {header}
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">Falta la orden de pago</p>
          <p className="mt-1 text-amber-900/80">
            Entrá a una orden en estado “Pendiente de pago” y usá el botón
            “Registrar pago”.
          </p>
          <Link
            href="/tesoreria/ordenes-de-pago"
            className="palacio-btn-secondary mt-3 inline-flex px-4 py-2.5 text-sm"
          >
            Ver órdenes de pago
          </Link>
        </div>
      </div>
    );
  }

  const [{ data, error }, mediosRes] = await Promise.all([
    obtenerOrdenPago(idOrden),
    listarMediosPago(false),
  ]);

  const ordenInvalida =
    error || !data?.orden || !ESTADOS_PAGABLES.has(data.orden.estado);

  if (ordenInvalida) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8">
        {header}
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">La orden no admite pagos</p>
          <p className="mt-1 text-amber-900/80">
            {error ??
              `La orden está en estado “${data?.orden?.estado ?? "desconocido"}”. Solo se puede pagar una orden “Pendiente de pago” o “Pagada parcial”.`}
          </p>
          <Link
            href={`/tesoreria/ordenes-de-pago/${idOrden}`}
            className="palacio-btn-secondary mt-3 inline-flex px-4 py-2.5 text-sm"
          >
            Volver a la orden
          </Link>
        </div>
      </div>
    );
  }

  const medios = (mediosRes.data ?? [])
    .filter((m) => m.activo)
    .map((m) => ({
      id_medio_pago: m.id_medio_pago,
      nombre_medio_pago: m.nombre_medio_pago,
      tipo: m.tipo,
      requiere_referencia: Boolean(m.requiere_referencia),
    }));

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[
          { label: "Tesorería" },
          { label: "Pagos", href: "/tesoreria/pagos" },
          { label: data.orden.nombre_proveedor ?? "Registrar" },
        ]}
        title="Registrar pago"
        description="Revisá los comprobantes a cancelar y los medios de pago que trae la orden. Podés ajustarlos antes de confirmar."
      />

      <PagoForm
        orden={data.orden}
        comprobantes={data.comprobantes ?? []}
        mediosOrden={data.medios ?? []}
        medios={medios}
      />
    </div>
  );
}
