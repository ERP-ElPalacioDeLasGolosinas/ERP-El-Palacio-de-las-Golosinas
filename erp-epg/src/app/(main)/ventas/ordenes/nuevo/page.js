import Link from "next/link";
import { getUserWithRole } from "@/lib/auth/roles";
import { listarCajas } from "@/lib/cajas/actions";
import { obtenerMiSesion } from "@/lib/cajas/v2-actions";
import { cargarDatosFormularioVenta } from "@/lib/ventas/datos-formulario";
import { VentaForm } from "@/components/ventas/VentaForm";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Registrar venta | Palacio · ERP",
};

export default async function RegistrarVentaPage() {
  const [datos, cajasRes, usuario] = await Promise.all([
    cargarDatosFormularioVenta(),
    listarCajas({ estado: "Abierta" }),
    getUserWithRole(),
  ]);
  // Un empleado solo vende por su propia caja; el gerente ve todas las abiertas.
  const miSesion = usuario?.rol === "Gerente" ? null : await obtenerMiSesion();
  const error = datos.error || cajasRes.error || miSesion?.error;
  const cajasVisibles = (cajasRes.data ?? []).filter(
    (c) => !miSesion || (miSesion.data?.id_caja && c.id_caja === miSesion.data.id_caja),
  );
  const { clientes, tipos, depositos, medios, listas } = datos;

  const faltantes = ["Mayorista", "Minorista"].filter((t) => !listas[t]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[
          { label: "Ventas" },
          { label: "Ventas", href: "/ventas/ordenes" },
          { label: "Registrar venta" },
        ]}
        title="Registrar venta"
        description="Mayorista: se emite el comprobante y el cobro queda para Tesorería, una vez despachada. Minorista y consumidor final: se cobran en la caja abierta y quedan pagadas."
      />

      {error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudieron cargar los datos del formulario</p>
          <p className="mt-1 text-amber-900/80">{error}</p>
        </div>
      ) : (
        <>
          {faltantes.length > 0 ? (
            <div className="palacio-card mb-6 border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
              <p className="font-medium">
                No hay lista de precios {faltantes.join(" ni ")} vigente
              </p>
              <p className="mt-1 text-amber-900/80">
                Las ventas de ese tipo no se pueden registrar hasta que haya una.{" "}
                <Link href="/ventas/listas-de-precios" className="underline">
                  Ir a Listas de precios
                </Link>
              </p>
            </div>
          ) : null}
          <VentaForm
            clientes={clientes}
            tipos={tipos}
            depositos={depositos}
            listas={listas}
            medios={medios}
            cajasAbiertas={cajasVisibles
              .filter((c) => c.id_deposito)
              .map((c) => ({
                id_caja: c.id_caja,
                id_deposito: c.id_deposito,
                nombre_deposito: c.nombre_deposito,
                abierta_por_nombre: c.abierta_por_nombre,
                fecha_apertura: c.fecha_apertura,
                monto_inicial: Number(c.monto_inicial) || 0,
              }))}
          />
        </>
      )}
    </div>
  );
}
