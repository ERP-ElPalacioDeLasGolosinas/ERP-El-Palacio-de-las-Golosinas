import { createClient } from "@/lib/supabase/server";

const CLAVES = ["emisor_razon_social", "emisor_cuit", "emisor_domicilio", "emisor_telefono"];

/**
 * Datos del emisor del comprobante, guardados en tienda_parametro (clave/valor).
 * Si faltan o están vacíos devuelve cadena vacía; el que renderiza muestra un guión.
 *
 * @returns {Promise<{ razonSocial: string, cuit: string, domicilio: string, telefono: string }>}
 */
export async function obtenerEmisor() {
  const supabase = await createClient();
  const { data } = await supabase.from("tienda_parametro").select("clave, valor").in("clave", CLAVES);

  const valores = Object.fromEntries((data ?? []).map((p) => [p.clave, (p.valor ?? "").trim()]));
  return {
    razonSocial: valores.emisor_razon_social ?? "",
    cuit: valores.emisor_cuit ?? "",
    domicilio: valores.emisor_domicilio ?? "",
    telefono: valores.emisor_telefono ?? "",
  };
}
