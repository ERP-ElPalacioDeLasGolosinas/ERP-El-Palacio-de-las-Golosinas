import { listarPedidosWeb } from "@/lib/pedidos-web/actions";
import { listarDepositos } from "@/lib/depositos/actions";
import Link from "next/link";
import { PreparacionBoard } from "@/components/pedidos-web/PreparacionBoard";
import { PedidosWebTable } from "@/components/pedidos-web/PedidosWebTable";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Preparación de pedidos | Palacio · ERP",
};

const VISTAS = [
  { clave: "cola", titulo: "Cola de trabajo" },
  { clave: "pagos", titulo: "Pagos por verificar", estados: ["Pendiente de pago"] },
  { clave: "historial", titulo: "Historial", estados: ["Despachado", "Retirado", "Cancelado"] },
];

/**
 * @param {{ searchParams: Promise<{ deposito?: string, vista?: string, desde?: string, hasta?: string }> }} props
 */
export default async function PedidosWebPage({ searchParams }) {
  const sp = await searchParams;
  const vista = VISTAS.find((v) => v.clave === sp?.vista) ?? VISTAS[0];
  const enCola = vista.clave === "cola";
  const deposito = enCola ? sp?.deposito || "" : "";
  const desde = enCola ? "" : sp?.desde || "";
  const hasta = enCola ? "" : sp?.hasta || "";

  const [{ data, error }, { data: depositos }] = await Promise.all([
    listarPedidosWeb({ deposito, desde, hasta }),
    listarDepositos(false),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[{ label: "Ventas" }, { label: "Preparación de pedidos" }]}
        title="Preparación de pedidos"
        description="Cola de trabajo de los pedidos de la tienda online, por etapa. Los más antiguos van primero."
      />

      <nav className="mb-4 flex gap-1 border-b border-palacio-border">
        {VISTAS.map((v) => (
          <Link
            key={v.clave}
            href={v.clave === "cola" ? "/ventas/pedidos-web" : `/ventas/pedidos-web?vista=${v.clave}`}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              v.clave === vista.clave
                ? "border-zinc-900 text-zinc-900"
                : "border-transparent text-palacio-muted hover:text-zinc-900"
            }`}
          >
            {v.titulo}
          </Link>
        ))}
      </nav>

      {error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudieron cargar los pedidos</p>
          <p className="mt-1 text-amber-900/80">{error}</p>
        </div>
      ) : enCola ? (
        <PreparacionBoard pedidos={data ?? []} depositos={depositos ?? []} deposito={deposito} />
      ) : (
        <PedidosWebTable
          pedidos={(data ?? []).filter((p) => vista.estados.includes(p.estado))}
          filtros={{ desde, hasta }}
        />
      )}
    </div>
  );
}
