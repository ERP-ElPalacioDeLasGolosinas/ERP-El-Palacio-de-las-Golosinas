import { listarMovimientos } from "@/lib/movimientos/actions";
import { listarDepositos } from "@/lib/depositos/actions";
import { listarTiposMovimiento } from "@/lib/tipos-movimiento/actions";
import { MovimientoForm } from "@/components/movimientos/MovimientoForm";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Registrar movimiento | Palacio · ERP",
};

export default async function NuevoMovimientoPage() {
  const [depositosRes, tiposRes, movimientosRes] = await Promise.all([
    listarDepositos(),
    listarTiposMovimiento(false),
    listarMovimientos(),
  ]);

  const depositos = (depositosRes.data ?? [])
    .filter((d) => d.activo)
    .map((d) => ({
      id_deposito: d.id_deposito,
      nombre_deposito: d.nombre_deposito,
    }));
  const tipos = (tiposRes.data ?? []).map((t) => ({
    id_tipo_movimiento: t.id_tipo_movimiento,
    nombre: t.nombre,
    signo: t.signo,
    requiere_deposito_destino: t.requiere_deposito_destino === true,
  }));
  const movimientos = (movimientosRes.data ?? []).map((m) => ({
    id_movimiento: m.id_movimiento,
    fecha_movimiento: m.fecha_movimiento,
    tipo_movimiento_nombre: m.tipo_movimiento_nombre,
    producto_nombre_completo: m.producto_nombre_completo ?? m.nombre_producto,
  }));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[
          { label: "Inventario" },
          { label: "Movimientos", href: "/inventario/movimientos" },
          { label: "Registrar" },
        ]}
        title="Registrar movimiento"
        description="Alta de un ingreso o egreso de stock. Impacta el stock y descuenta lotes por vencimiento (FIFO)."
      />

      <MovimientoForm tipos={tipos} depositos={depositos} movimientos={movimientos} />
    </div>
  );
}
