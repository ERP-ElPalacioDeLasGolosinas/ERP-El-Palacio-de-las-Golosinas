import Link from "next/link";
import { obtenerCaja } from "@/lib/cajas/actions";
import { TIPOS_MEDIO_NO_CAJA } from "@/lib/cajas/constantes";
import { listarDepositos } from "@/lib/depositos/actions";
import { listarMediosPago } from "@/lib/medios-pago/actions";
import { ArqueoCajaForm } from "@/components/cajas/ArqueoCajaForm";
import { AsignarDepositoForm } from "@/components/cajas/AsignarDepositoForm";
import { CajaEncabezado } from "@/components/cajas/CajaEncabezado";
import { CierreCajaCard } from "@/components/cajas/CierreCajaCard";
import { MovimientoCajaForm } from "@/components/cajas/MovimientoCajaForm";
import { MovimientosCajaTable } from "@/components/cajas/MovimientosCajaTable";
import { ResumenCaja } from "@/components/cajas/ResumenCaja";
import { fechaHora, moneda } from "@/components/cajas/formato";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Caja | Palacio · ERP",
};

const crumbs = [
  { label: "Ventas" },
  { label: "Cajas", href: "/ventas/cajas" },
  { label: "Historial", href: "/ventas/cajas/historial" },
];

/**
 * @param {{ params: Promise<{ id: string }> }} props
 */
export default async function CajaDetallePage({ params }) {
  const { id } = await params;
  const { data, error } = await obtenerCaja(id);
  const abierta = data?.caja?.estado === "Abierta";
  const [mediosRes, depositosRes] = abierta
    ? await Promise.all([listarMediosPago(false), listarDepositos(false)])
    : [{ data: [] }, { data: [] }];

  if (error || !data) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8">
        <PageHeader crumbs={crumbs} title="Caja" />
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudo cargar la caja</p>
          <p className="mt-1 text-amber-900/80">{error ?? "La caja no existe."}</p>
        </div>
      </div>
    );
  }

  const { caja, arqueos = [], movimientos = [] } = data;
  const resumen = caja.estado === "Cerrada" && caja.resumen_cierre ? caja.resumen_cierre : data.resumen;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[...crumbs, { label: fechaHora(caja.fecha_apertura) }]}
        title={caja.estado === "Cerrada" ? "Resumen de cierre" : caja.nombre_deposito || "Caja abierta"}
        actions={
          caja.estado === "Abierta" ? (
            <>
              {caja.id_deposito ? (
                <Link href="/ventas/ordenes/nuevo" className="palacio-btn-primary inline-flex px-4 py-2.5 text-sm">
                  Registrar venta
                </Link>
              ) : null}
              <Link href="/ventas/cajas" className="palacio-btn-secondary inline-flex px-4 py-2.5 text-sm">
                Cajas abiertas
              </Link>
            </>
          ) : null
        }
      />

      <CajaEncabezado caja={caja} />

      {caja.estado === "Abierta" && !caja.id_deposito ? (
        <AsignarDepositoForm
          idCaja={caja.id_caja}
          depositos={(depositosRes.data ?? [])
            .filter((d) => d.activo)
            .map((d) => ({ id_deposito: d.id_deposito, nombre_deposito: d.nombre_deposito }))}
        />
      ) : null}

      {caja.estado === "Cerrada" ? (
        <div className="palacio-card mb-6 grid gap-4 px-5 py-4 text-sm sm:grid-cols-3">
          <Total label="Efectivo teórico" valor={moneda(caja.saldo_teorico_efectivo)} />
          <Total label="Efectivo contado" valor={moneda(caja.saldo_fisico_efectivo)} />
          <Total
            label="Diferencia"
            valor={moneda(caja.diferencia_efectivo)}
            className={Number(caja.diferencia_efectivo) === 0 ? "text-zinc-900" : "text-amber-700"}
          />
        </div>
      ) : null}

      <ResumenCaja resumen={resumen} />

      {caja.estado === "Abierta" ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <MovimientoCajaForm
            idCaja={caja.id_caja}
            resumen={resumen}
            medios={(mediosRes.data ?? [])
              .filter((m) => m.activo && !TIPOS_MEDIO_NO_CAJA.has(m.tipo))
              .map((m) => ({
                id_medio_pago: m.id_medio_pago,
                nombre_medio_pago: m.nombre_medio_pago,
                tipo: m.tipo,
                requiere_referencia: Boolean(m.requiere_referencia),
              }))}
          />
          <ArqueoCajaForm idCaja={caja.id_caja} resumen={resumen} />
          <CierreCajaCard idCaja={caja.id_caja} resumen={resumen} />
        </div>
      ) : null}

      <div className="mt-6">
        <MovimientosCajaTable movimientos={movimientos} />
      </div>

      <div className="palacio-card mt-6 overflow-hidden">
        <div className="border-b border-palacio-border px-5 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">Arqueos</h2>
        </div>
        {arqueos.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-palacio-muted">Sin arqueos.</p>
        ) : (
          <ul className="divide-y divide-palacio-border text-sm">
            {arqueos.map((a) => (
              <li key={a.id_arqueo} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <span className="text-palacio-muted">
                  {fechaHora(a.creado)} · {a.creado_por_nombre}
                  {a.observaciones ? ` · ${a.observaciones}` : ""}
                </span>
                <span>
                  Teórico {moneda(a.saldo_teorico)} · Contado {moneda(a.saldo_fisico)} ·{" "}
                  <span className={Number(a.diferencia) === 0 ? "font-medium" : "font-semibold text-amber-700"}>
                    Dif. {moneda(a.diferencia)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Total({ label, valor, className = "text-zinc-900" }) {
  return (
    <div>
      <p className="text-[11px] font-semibold tracking-wider text-palacio-muted uppercase">{label}</p>
      <p className={`text-lg font-bold ${className}`}>{valor}</p>
    </div>
  );
}
