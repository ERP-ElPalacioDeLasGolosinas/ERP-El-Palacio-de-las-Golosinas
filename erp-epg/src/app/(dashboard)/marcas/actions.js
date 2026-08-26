"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const MAX_NOMBRE = 60;

// Shape común devuelto a useActionState: { ok: boolean, error: string | null }
const exito = () => ({ ok: true, error: null });
const fallo = (error) => ({ ok: false, error });

function mapearError(error) {
  switch (error?.code) {
    case "23505":
      return "Ya existe una marca con ese nombre.";
    case "42501":
      return "No tenés permisos para realizar esta acción.";
    case "23514":
      return "El nombre de la marca no puede estar vacío.";
    default:
      return "Ocurrió un error inesperado. Probá de nuevo.";
  }
}

function validarNombre(formData) {
  const nombre = String(formData.get("nombre_marca") ?? "").trim();
  if (!nombre) return { error: "Ingresá un nombre de marca." };
  if (nombre.length > MAX_NOMBRE)
    return { error: `El nombre no puede superar los ${MAX_NOMBRE} caracteres.` };
  return { nombre };
}

/**
 * Identificador del usuario para auditoría (creado_por), o null si no hay
 * sesión. No bloquea: RLS está deshabilitado temporalmente hasta que llegue
 * el login; cuando se reactive, los errores de permiso los mapea 42501.
 */
async function usuarioActual(supabase) {
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.email ?? data?.claims?.sub ?? null;
}

export async function crearMarca(prevState, formData) {
  const { nombre, error: errorNombre } = validarNombre(formData);
  if (errorNombre) return fallo(errorNombre);

  const supabase = await createClient();

  const { error } = await supabase.from("marca").insert({
    nombre_marca: nombre,
    creado_por: await usuarioActual(supabase),
  });
  if (error) return fallo(mapearError(error));

  revalidatePath("/marcas");
  return exito();
}

export async function renombrarMarca(prevState, formData) {
  const id = String(formData.get("id_marca") ?? "");
  if (!id) return fallo("Falta el identificador de la marca.");

  const { nombre, error: errorNombre } = validarNombre(formData);
  if (errorNombre) return fallo(errorNombre);

  const supabase = await createClient();

  // Un UPDATE sobre una fila inexistente (o filtrada por RLS) NO da error:
  // afecta 0 filas. El .select() posterior detecta ese no-op silencioso.
  const { data: filas, error } = await supabase
    .from("marca")
    .update({ nombre_marca: nombre })
    .eq("id_marca", id)
    .select("id_marca");
  if (error) return fallo(mapearError(error));
  if (!filas?.length) return fallo("No se encontró la marca a actualizar.");

  revalidatePath("/marcas");
  return exito();
}

export async function cambiarActivoMarca(prevState, formData) {
  const id = String(formData.get("id_marca") ?? "");
  if (!id) return fallo("Falta el identificador de la marca.");
  const activo = String(formData.get("activo")) === "true";

  const supabase = await createClient();

  const { data: filas, error } = await supabase
    .from("marca")
    .update({ activo })
    .eq("id_marca", id)
    .select("id_marca");
  if (error) return fallo(mapearError(error));
  if (!filas?.length) return fallo("No se encontró la marca a actualizar.");

  revalidatePath("/marcas");
  return exito();
}
