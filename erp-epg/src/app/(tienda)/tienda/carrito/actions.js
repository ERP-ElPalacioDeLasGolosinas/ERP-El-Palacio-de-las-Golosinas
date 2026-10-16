"use server";

import { revalidatePath } from "next/cache";
import { esUuid } from "@/lib/tienda/catalogo";
import {
  MAX_CANTIDAD,
  MAX_LINEAS,
  guardarCarrito,
  leerCarrito,
  normalizarCantidad,
} from "@/lib/tienda/carrito";

export async function agregarAlCarrito(formData) {
  const id = formData.get("id_producto");
  const cantidad = normalizarCantidad(formData.get("cantidad") ?? 1);
  if (!esUuid(id) || !cantidad) return;
  const items = await leerCarrito();
  const linea = items.find((l) => l.id_producto === id);
  if (linea) linea.cantidad = Math.min(linea.cantidad + cantidad, MAX_CANTIDAD);
  else if (items.length < MAX_LINEAS) items.push({ id_producto: id, cantidad });
  await guardarCarrito(items);
  revalidatePath("/", "layout");
}

export async function cambiarCantidad(formData) {
  const id = formData.get("id_producto");
  const cantidad = normalizarCantidad(formData.get("cantidad"));
  if (!esUuid(id) || !cantidad) return;
  const items = await leerCarrito();
  const linea = items.find((l) => l.id_producto === id);
  if (!linea) return;
  linea.cantidad = cantidad;
  await guardarCarrito(items);
  revalidatePath("/", "layout");
}

export async function quitarDelCarrito(formData) {
  const id = formData.get("id_producto");
  if (!esUuid(id)) return;
  const items = await leerCarrito();
  await guardarCarrito(items.filter((l) => l.id_producto !== id));
  revalidatePath("/", "layout");
}
