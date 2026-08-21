"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const RUTA_TIPOS_MOVIMIENTO = "/stock/tipos-movimiento";
const SIGNOS_VALIDOS = new Set(["1", "-1"]);

function normalizarTexto(valor) {
  return typeof valor === "string" ? valor.trim() : "";
}

function mensajeErrorSupabase(error) {
  if (error?.code === "23505") {
    return "Ya existe un tipo de movimiento con ese nombre.";
  }
  return "No se pudo guardar el tipo de movimiento. Intentá nuevamente.";
}

export async function crearTipoMovimiento(_prevState, formData) {
  const nombre = normalizarTexto(formData.get("nombre_tipo_movimiento"));
  const descripcion = normalizarTexto(
    formData.get("descripcion_tipo_movimiento")
  );
  const signo = formData.get("signo_tipo_movimiento");

  if (!nombre) {
    return { error: "El nombre es obligatorio." };
  }
  if (!descripcion) {
    return { error: "La descripción es obligatoria." };
  }
  if (!SIGNOS_VALIDOS.has(signo)) {
    return { error: "Debés indicar el signo del movimiento (entrada o salida)." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("tipo_movimiento").insert({
    nombre_tipo_movimiento: nombre,
    descripcion_tipo_movimiento: descripcion,
    signo_tipo_movimiento: Number(signo),
  });

  if (error) {
    return { error: mensajeErrorSupabase(error) };
  }

  revalidatePath(RUTA_TIPOS_MOVIMIENTO);
  return { error: null, success: true };
}

export async function editarTipoMovimiento(_prevState, formData) {
  const id = formData.get("id_tipo_movimiento");
  const nombre = normalizarTexto(formData.get("nombre_tipo_movimiento"));
  const descripcion = normalizarTexto(
    formData.get("descripcion_tipo_movimiento")
  );

  if (!id) {
    return { error: "Tipo de movimiento inválido." };
  }
  if (!nombre) {
    return { error: "El nombre es obligatorio." };
  }
  if (!descripcion) {
    return { error: "La descripción es obligatoria." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("tipo_movimiento")
    .update({
      nombre_tipo_movimiento: nombre,
      descripcion_tipo_movimiento: descripcion,
    })
    .eq("id_tipo_movimiento", id);

  if (error) {
    return { error: mensajeErrorSupabase(error) };
  }

  revalidatePath(RUTA_TIPOS_MOVIMIENTO);
  return { error: null, success: true };
}

export async function cambiarActivoTipoMovimiento(id, activo) {
  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from("tipo_movimiento")
    .update({ activo })
    .eq("id_tipo_movimiento", id);

  revalidatePath(RUTA_TIPOS_MOVIMIENTO);
}
