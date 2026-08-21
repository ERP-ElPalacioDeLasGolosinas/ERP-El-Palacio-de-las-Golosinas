import { createClient } from "@/lib/supabase/server";
import NuevoTipoMovimientoForm from "./NuevoTipoMovimientoForm";
import TipoMovimientoRow from "./TipoMovimientoRow";

export const metadata = {
  title: "Tipos de movimiento de stock — ERP EPG",
};

export default async function TiposMovimientoPage() {
  const supabase = await createClient();
  const { data: tiposMovimiento, error } = await supabase
    .from("tipo_movimiento")
    .select(
      "id_tipo_movimiento, nombre_tipo_movimiento, descripcion_tipo_movimiento, signo_tipo_movimiento, activo"
    )
    .order("nombre_tipo_movimiento", { ascending: true });

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Tipos de movimiento de stock</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Catálogo de tipos de movimiento (ingreso, egreso, ajuste, etc.) que
          se usará al registrar movimientos de stock.
        </p>
      </div>

      <NuevoTipoMovimientoForm />

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          No se pudieron cargar los tipos de movimiento.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/15">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 bg-black/[.03] dark:border-white/10 dark:bg-white/[.06]">
                <th className="p-3 font-medium">Nombre</th>
                <th className="p-3 font-medium">Descripción</th>
                <th className="p-3 font-medium">Signo</th>
                <th className="p-3 font-medium">Estado</th>
                <th className="p-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {tiposMovimiento && tiposMovimiento.length > 0 ? (
                tiposMovimiento.map((tipoMovimiento) => (
                  <TipoMovimientoRow
                    key={tipoMovimiento.id_tipo_movimiento}
                    tipoMovimiento={tipoMovimiento}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-3 text-black/60 dark:text-white/60">
                    Todavía no hay tipos de movimiento cargados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
