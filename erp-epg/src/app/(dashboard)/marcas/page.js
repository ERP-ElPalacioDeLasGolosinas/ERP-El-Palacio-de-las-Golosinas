import MarcasManager from "@/components/marcas/MarcasManager";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Marcas — ERP El Palacio de las Golosinas" };

const fmtFecha = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "medium",
  timeZone: "America/Argentina/Buenos_Aires",
});

export default async function MarcasPage() {
  const supabase = await createClient();

  const { data: marcas, error } = await supabase
    .from("marca")
    .select("id_marca, nombre_marca, activo, creado, creado_por")
    .order("nombre_marca", { ascending: true });

  if (error) {
    // Detalle técnico solo en los logs del server; el boundary (error.js)
    // muestra un mensaje fijo (en prod Next redacta los messages igualmente).
    console.error("[/marcas] Error al consultar la tabla marca:", error);
    throw new Error("No se pudieron cargar las marcas.");
  }

  // Fechas formateadas en el server (locale y timezone fijos) para evitar
  // mismatch de hidratación entre server y cliente.
  const filas = (marcas ?? []).map((m) => ({
    ...m,
    creado_fmt: m.creado ? fmtFecha.format(new Date(m.creado)) : "—",
  }));

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-1 text-xs text-tinta-suave">
        Artículos y catálogo &nbsp;›&nbsp; <b className="text-tinta">Marcas</b>
      </div>
      <h1 className="font-baloo text-2xl font-bold tracking-[0.2px]">
        Marcas de artículos
      </h1>
      <p className="mb-5 mt-0.5 text-sm text-tinta-suave">
        Alta, renombrado y baja lógica de las marcas del catálogo.
      </p>

      <MarcasManager marcas={filas} />
    </div>
  );
}
