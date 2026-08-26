import { createClient } from "@/lib/supabase/server";
import UnidadesMedidaClient from "./unidades-medida-client";

export default async function UnidadesMedidaPage() {
  const supabase = await createClient();
  const { data: unidades } = await supabase
    .from("unidad_medida")
    .select("id_unidad_medida, nombre_unidad_medida, abreviatura_unidad_medida, activo")
    .order("nombre_unidad_medida");

  return <UnidadesMedidaClient unidades={unidades ?? []} />;
}
