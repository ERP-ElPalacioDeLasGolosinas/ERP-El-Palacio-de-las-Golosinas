import Link from "next/link";
import { listarMovimientos } from "@/lib/movimientos/actions";
import { listarProductos } from "@/lib/productos/actions";
import { listarDepositos } from "@/lib/depositos/actions";
import { listarTiposMovimiento } from "@/lib/tipos-movimiento/actions";
import { MovimientosTable } from "@/components/movimientos/MovimientosTable";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Movimientos de stock | Palacio · ERP",
};

/**
 * @param {{ searchParams: Promise<{
 *   producto?: string, deposito?: string, tipo?: string, desde?: string, hasta?: string
 * }> }} props
 */
export default async function MovimientosPage({ searchParams }) {
  const sp = (await searchParams) ?? {};
  const filtros = {
    id_producto: sp.producto ?? null,
    id_deposito: sp.deposito ?? null,
    id_tipo_movimiento: sp.tipo ?? null,
    fecha_desde: sp.desde ?? null,
    fecha_hasta: sp.hasta ?? null,
  };

  const [{ data, error }, productosRes, depositosRes, tiposRes] =
    await Promise.all([
      listarMovimientos(filtros),
      listarProductos(false),
      listarDepositos(),
      listarTiposMovimiento(true),
    ]);

  const productos = (productosRes.data ?? []).map((p) => ({
    id_producto: p.id_producto,
    nombre_completo: p.nombre_completo ?? p.nombre_producto,
  }));
  const depositos = (depositosRes.data ?? []).map((d) => ({
    id_deposito: d.id_deposito,
    nombre_deposito: d.nombre_deposito,
  }));
  const tipos = (tiposRes.data ?? []).map((t) => ({
    id_tipo_movimiento: t.id_tipo_movimiento,
    nombre: t.nombre,
  }));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[{ label: "Inventario" }, { label: "Movimientos" }]}
        title="Historial de movimientos"
        description="Auditoría de entradas y salidas de stock por producto y depósito."
        actions={
          <Link
            href="/inventario/movimientos/nuevo"
            className="palacio-btn-primary inline-flex px-4 py-2.5 text-sm"
          >
            Nuevo movimiento
          </Link>
        }
      />

      {error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudieron cargar los movimientos</p>
          <p className="mt-1 text-amber-900/80">{error}</p>
        </div>
      ) : (
        <MovimientosTable
          movimientos={data ?? []}
          productos={productos}
          depositos={depositos}
          tipos={tipos}
          filtros={{
            producto: sp.producto ?? "",
            deposito: sp.deposito ?? "",
            tipo: sp.tipo ?? "",
            desde: sp.desde ?? "",
            hasta: sp.hasta ?? "",
          }}
        />
      )}
    </div>
  );
}
