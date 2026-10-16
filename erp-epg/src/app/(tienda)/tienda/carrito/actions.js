"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { esUuid } from "@/lib/tienda/catalogo";
import {
  MAX_CANTIDAD,
  MAX_LINEAS,
  guardarCarrito,
  leerCarrito,
  normalizarCantidad,
  validarCarrito,
} from "@/lib/tienda/carrito";

// El carrito solo funciona con sesión: sin ella no se toca la cookie.
async function haySesion() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return Boolean(user);
}

// Líneas validadas (en el orden en que se agregaron), total de las disponibles y si hay avisos.
export async function obtenerResumenCarrito() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { requiereLogin: true };
  const items = await leerCarrito();
  const { lineas, error } = await validarCarrito(supabase, items);
  if (error) return { error: true, filas: [], total: 0, conProblemas: false };
  const porId = new Map(lineas.map((l) => [l.id_producto, l]));
  const filas = items.map((it) => porId.get(it.id_producto)).filter(Boolean);
  const total = filas
    .filter((l) => l.estado === "ok")
    .reduce((acc, l) => acc + Number(l.precio) * Number(l.cantidad_solicitada), 0);
  return { filas, total, conProblemas: filas.some((l) => l.estado !== "ok") };
}

export async function agregarAlCarrito(formData) {
  if (!(await haySesion())) return { requiereLogin: true };
  const id = formData.get("id_producto");
  const cantidad = normalizarCantidad(formData.get("cantidad") ?? 1);
  if (!esUuid(id) || !cantidad) return;
  const items = await leerCarrito();
  const linea = items.find((l) => l.id_producto === id);
  if (linea) linea.cantidad = Math.min(linea.cantidad + cantidad, MAX_CANTIDAD);
  else if (items.length < MAX_LINEAS) items.push({ id_producto: id, cantidad });
  await guardarCarrito(items);
  revalidatePath("/tienda", "layout");
}

export async function cambiarCantidad(formData) {
  if (!(await haySesion())) return { requiereLogin: true };
  const id = formData.get("id_producto");
  const cantidad = normalizarCantidad(formData.get("cantidad"));
  if (!esUuid(id) || !cantidad) return;
  const items = await leerCarrito();
  const linea = items.find((l) => l.id_producto === id);
  if (!linea) return;
  linea.cantidad = cantidad;
  await guardarCarrito(items);
  revalidatePath("/tienda", "layout");
}

export async function quitarDelCarrito(formData) {
  if (!(await haySesion())) return { requiereLogin: true };
  const id = formData.get("id_producto");
  if (!esUuid(id)) return;
  const items = await leerCarrito();
  await guardarCarrito(items.filter((l) => l.id_producto !== id));
  revalidatePath("/tienda", "layout");
}
