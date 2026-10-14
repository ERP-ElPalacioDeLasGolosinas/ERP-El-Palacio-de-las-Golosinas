import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserWithRole } from "@/lib/auth/roles";
import { listarEmpleadosDisponibles, obtenerMiSesion, obtenerPanelCajas } from "@/lib/cajas/v2-actions";
import { listarDepositos } from "@/lib/depositos/actions";
import { PanelCajas } from "@/components/cajas/v2/PanelCajas";
import { SesionPendiente } from "@/components/cajas/v2/SesionPendiente";
import { SolicitarAperturaForm } from "@/components/cajas/v2/SolicitarAperturaForm";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Cajas | Palacio · ERP",
};

/**
 * Flujo cajav2 (experimental): el gerente ve el panel de todas las cajas; el
 * empleado elige su caja y pide la apertura, espera la aprobación o entra a su POS.
 */
export default async function CajasPage({ searchParams }) {
  const { sucursal: idSucursal, nueva } = await searchParams;
  const usuario = await getUserWithRole();
  const esGerente = usuario?.rol === "Gerente";

  const historial = (
    <Link href="/ventas/cajas/historial" className="palacio-btn-secondary inline-flex px-4 py-2.5 text-sm">
      Historial
    </Link>
  );

  if (esGerente) {
    const [panelRes, depositosRes, empleadosRes] = await Promise.all([
      obtenerPanelCajas(),
      listarDepositos(false),
      listarEmpleadosDisponibles(),
    ]);
    const depositos = (depositosRes.data ?? [])
      .filter((d) => d.activo)
      .map((d) => ({ id_deposito: d.id_deposito, nombre_deposito: d.nombre_deposito }));

    const todas = panelRes.data ?? [];
    const sucursal = depositos.find((d) => d.id_deposito === idSucursal) ?? null;
    const error = panelRes.error || depositosRes.error || empleadosRes.error;
    const actions = (
      <div className="flex flex-wrap gap-2">
        {sucursal ? (
          <>
            <Link
              href={`/ventas/cajas?sucursal=${sucursal.id_deposito}&nueva=1`}
              className="palacio-btn-primary inline-flex px-4 py-2.5 text-sm"
            >
              Nueva caja
            </Link>
            <Link href="/ventas/cajas" className="palacio-btn-secondary inline-flex px-4 py-2.5 text-sm">
              Cambiar sucursal
            </Link>
          </>
        ) : null}
        {historial}
      </div>
    );

    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
        <PageHeader
          crumbs={[{ label: "Ventas" }, { label: "Cajas" }]}
          title={sucursal ? `Cajas · ${sucursal.nombre_deposito}` : "Administración de cajas"}
          description={
            sucursal
              ? "Aprobá las aperturas que piden los empleados y confirmá los cierres de esta sucursal."
              : "Elegí la sucursal para ver y administrar sus cajas."
          }
          actions={actions}
        />
        {error ? (
          <Aviso titulo="No se pudieron cargar las cajas" detalle={error} />
        ) : sucursal ? (
          <PanelCajas
            cajas={todas.filter((c) => c.id_deposito === sucursal.id_deposito)}
            sucursal={sucursal}
            creando={nueva === "1"}
            siguiente={todas.reduce((max, c) => Math.max(max, Number(c.numero) || 0), 0) + 1}
            depositos={depositos}
            empleados={empleadosRes.data ?? []}
          />
        ) : (
          <SelectorSucursal
            sucursales={depositos.map((d) => ({
              ...d,
              cantidad: todas.filter((c) => c.id_deposito === d.id_deposito && (c.activa || c.sesion)).length,
            }))}
          />
        )}
      </div>
    );
  }

  const miSesion = await obtenerMiSesion();
  if (miSesion.data?.id_caja && miSesion.data.estado !== "Pendiente") {
    redirect(`/ventas/cajas/${miSesion.data.id_caja}`);
  }

  const panelRes = miSesion.data ? { data: [], error: null } : await obtenerPanelCajas();
  const error = miSesion.error || panelRes.error;
  const activas = (panelRes.data ?? []).filter((c) => c.activa);
  const sucursales = [...new Map(activas.map((c) => [c.id_deposito, c])).values()].map((c) => ({
    id_deposito: c.id_deposito,
    nombre_deposito: c.nombre_deposito,
    cantidad: activas.filter((o) => o.id_deposito === c.id_deposito).length,
  }));
  const sucursal = sucursales.find((s) => s.id_deposito === idSucursal) ?? null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[{ label: "Ventas" }, { label: "Cajas" }]}
        title="Mi caja"
        description={
          miSesion.data || sucursal
            ? "Elegí la caja en la que vas a trabajar toda la sesión y cargá el efectivo inicial."
            : "Elegí la sucursal en la que vas a trabajar."
        }
        actions={historial}
      />
      {error ? (
        <Aviso titulo="No se pudieron cargar las cajas" detalle={error} />
      ) : miSesion.data ? (
        <SesionPendiente sesion={miSesion.data} />
      ) : sucursal ? (
        <>
          <Link href="/ventas/cajas" className="mb-4 inline-block text-sm underline">
            ← Cambiar sucursal ({sucursal.nombre_deposito})
          </Link>
          <SolicitarAperturaForm cajas={activas.filter((c) => c.id_deposito === sucursal.id_deposito)} />
        </>
      ) : (
        <SelectorSucursal sucursales={sucursales} />
      )}
    </div>
  );
}

function SelectorSucursal({ sucursales }) {
  if (sucursales.length === 0) {
    return (
      <div className="palacio-card px-6 py-12 text-center text-sm text-palacio-muted">
        No hay sucursales con cajas. Pedile al gerente que cree una.
      </div>
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {sucursales.map((s) => (
        <li key={s.id_deposito}>
          <Link
            href={`/ventas/cajas?sucursal=${s.id_deposito}`}
            className="palacio-card block px-5 py-4 transition hover:border-zinc-400"
          >
            <p className="text-sm font-semibold text-zinc-900">{s.nombre_deposito}</p>
            <p className="mt-1 text-xs text-palacio-muted">
              {s.cantidad === 1 ? "1 caja" : `${s.cantidad} cajas`}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Aviso({ titulo, detalle }) {
  return (
    <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
      <p className="font-medium">{titulo}</p>
      <p className="mt-1 text-amber-900/80">{detalle}</p>
    </div>
  );
}
