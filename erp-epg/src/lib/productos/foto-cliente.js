"use client";

import { createClient } from "@/lib/supabase/client";
import { asignarImagenProducto } from "@/lib/productos/actions";

const BUCKET = "productos";
const LADO_MAX = 900;
export const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp"];

// Achica la foto en el navegador (lado mayor 900 px, WebP) para que pese poco en la tienda.
async function prepararImagen(file) {
  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
  if (!blob) throw new Error("No se pudo procesar la imagen.");
  return blob;
}

// Borra del bucket las fotos de la carpeta del artículo, salvo `conservar` (nombre de archivo).
async function limpiarCarpeta(supabase, idProducto, conservar = null) {
  const { data } = await supabase.storage.from(BUCKET).list(idProducto);
  const sobrantes = (data ?? []).filter((o) => o.name !== conservar).map((o) => `${idProducto}/${o.name}`);
  if (sobrantes.length > 0) await supabase.storage.from(BUCKET).remove(sobrantes);
}

/**
 * Sube la foto del artículo (achicada), la asigna y deja una sola foto en su carpeta.
 * Lanza Error con un mensaje para mostrar si algo falla.
 */
export async function subirFotoProducto(idProducto, file) {
  if (!TIPOS_FOTO.includes(file.type)) throw new Error("La foto debe ser JPG, PNG o WebP.");
  const blob = await prepararImagen(file);
  const supabase = createClient();
  const nombre = `${Date.now()}.webp`;
  const ruta = `${idProducto}/${nombre}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, blob, { contentType: "image/webp", cacheControl: "31536000" });
  if (error) throw new Error("No se pudo subir la foto.");

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(ruta);
  const r = await asignarImagenProducto(idProducto, pub.publicUrl);
  if (!r.ok) {
    await supabase.storage.from(BUCKET).remove([ruta]);
    throw new Error(r.error);
  }
  await limpiarCarpeta(supabase, idProducto, nombre);
  return pub.publicUrl;
}

/** Quita la foto del artículo y borra sus archivos del bucket. */
export async function quitarFotoProducto(idProducto) {
  const r = await asignarImagenProducto(idProducto, null);
  if (!r.ok) throw new Error(r.error);
  await limpiarCarpeta(createClient(), idProducto);
}
