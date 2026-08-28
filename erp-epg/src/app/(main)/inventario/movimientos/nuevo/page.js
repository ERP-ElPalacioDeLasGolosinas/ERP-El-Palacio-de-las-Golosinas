import { listarMovimientos } from "@/lib/movimientos/actions";
import { listarProductos } from "@/lib/productos/actions";
import { listarDepositos } from "@/lib/depositos/actions";
import { listarTiposMovimiento } from "@/lib/tipos-movimiento/actions";
import { MovimientoForm } from "@/components/movimientos/MovimientoForm";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Registrar movimiento | Palacio · ERP",
};

export default async function NuevoMovimientoPage() {
  const [productosRes, depositosRes, tiposRes, movimientosRes] =
    await Promise.all([
      listarProductos(false),
      listarDepositos(),
      listarTiposMovimiento(false),
      listarMovimientos(),
    ]);

  const productos = (productosRes.data ?? []).map((p) => ({
    id_producto: p.id_producto,
    nombre_completo: p.nombre_completo ?? p.nombre_producto,
  }));
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

      <MovimientoForm
        tipos={tipos}
        productos={productos}
        depositos={depositos}
        movimientos={movimientos}
      />
    </div>
  );
}
