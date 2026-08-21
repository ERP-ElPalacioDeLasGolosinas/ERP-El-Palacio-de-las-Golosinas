"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function mapErrorUnidadMedida(error, accionFallback) {
  if (error.code === "23505") {
    const mensaje = error.message ?? "";
    if (mensaje.includes("unidad_medida_nombre_uidx")) {
      return "Ya existe una unidad de medida con ese nombre.";
    }
    if (mensaje.includes("unidad_medida_abreviatura_uidx")) {
      return "Ya existe una unidad de medida con esa abreviatura.";
    }
    return "Ya existe una unidad de medida con esos datos.";
  }
  if (error.code === "23514") {
    return "El nombre y la abreviatura no pueden estar vacíos.";
  }
  return accionFallback;
}

export async function crearUnidadMedida(prevState, formData) {
  const nombre = (formData.get("nombre") ?? "").toString().trim();
  const abreviatura = (formData.get("abreviatura") ?? "").toString().trim();

  const supabase = await createClient();
  const { error } = await supabase.from("unidad_medida").insert({
    nombre_unidad_medida: nombre,
    abreviatura_unidad_medida: abreviatura,
  });

  if (error) {
    console.error("crearUnidadMedida:", error);
    return {
      error: mapErrorUnidadMedida(
        error,
        "No se pudo crear la unidad de medida. Intentá nuevamente."
      ),
    };
  }

  revalidatePath("/unidades-medida");
  return { error: null, success: true };
}

export async function actualizarUnidadMedida(prevState, formData) {
  const id = (formData.get("id") ?? "").toString();
  const nombre = (formData.get("nombre") ?? "").toString().trim();
  const abreviatura = (formData.get("abreviatura") ?? "").toString().trim();

  const supabase = await createClient();
  const { error } = await supabase
    .from("unidad_medida")
    .update({
      nombre_unidad_medida: nombre,
      abreviatura_unidad_medida: abreviatura,
    })
    .eq("id_unidad_medida", id);

  if (error) {
    console.error("actualizarUnidadMedida:", error);
    return {
      error: mapErrorUnidadMedida(
        error,
        "No se pudo guardar la unidad de medida. Intentá nuevamente."
      ),
    };
  }

  revalidatePath("/unidades-medida");
  return { error: null, success: true };
}

export async function cambiarEstadoUnidadMedida(prevState, formData) {
  const id = (formData.get("id") ?? "").toString();
  const activo = formData.get("activo") === "true";

  const supabase = await createClient();
  const { error } = await supabase
    .from("unidad_medida")
    .update({ activo })
    .eq("id_unidad_medida", id);

  if (error) {
    console.error("cambiarEstadoUnidadMedida:", error);
    return { error: "No se pudo actualizar el estado. Intentá nuevamente." };
  }

  revalidatePath("/unidades-medida");
  return { error: null };
}
