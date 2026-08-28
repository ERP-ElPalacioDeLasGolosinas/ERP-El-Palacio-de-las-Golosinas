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
        <h1 className="font-baloo text-2xl font-bold text-tinta">
          Tipos de movimiento de stock
        </h1>
        <p className="text-sm text-tinta-suave">
          Catálogo de tipos de movimiento (ingreso, egreso, ajuste, etc.) que
          se usará al registrar movimientos de stock.
        </p>
      </div>

      <NuevoTipoMovimientoForm />

      {error ? (
        <p role="alert" className="text-sm font-medium text-rojo">
          No se pudieron cargar los tipos de movimiento.
        </p>
      ) : (
        <section className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr>
                  <th className="px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.6px] text-tinta-suave">
                    Nombre
                  </th>
                  <th className="px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.6px] text-tinta-suave">
                    Descripción
                  </th>
                  <th className="px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.6px] text-tinta-suave">
                    Signo
                  </th>
                  <th className="px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.6px] text-tinta-suave">
                    Estado
                  </th>
                  <th className="px-4 py-2.5 text-right text-[10.5px] font-bold uppercase tracking-[0.6px] text-tinta-suave">
                    Acciones
                  </th>
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
                    <td
                      colSpan={5}
                      className="border-t border-linea px-4 py-10 text-center text-sm text-tinta-suave"
                    >
                      Todavía no hay tipos de movimiento cargados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
