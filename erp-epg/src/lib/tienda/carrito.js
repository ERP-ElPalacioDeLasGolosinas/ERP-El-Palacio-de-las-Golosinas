import { cookies } from "next/headers";

export const COOKIE_CARRITO = "tienda_carrito";
export const MAX_LINEAS = 100;
export const MAX_CANTIDAD = 9999;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Cantidad entera entre 1 y MAX_CANTIDAD, o null si no es válida.
export function normalizarCantidad(v) {
  const n = Number.parseInt(v, 10);
  if (!Number.isInteger(n) || n < 1) return null;
  return Math.min(n, MAX_CANTIDAD);
}

// El carrito vive en una cookie httpOnly: [{ id_producto, cantidad }]. Tolera valores corruptos.
export async function leerCarrito() {
  const store = await cookies();
  const crudo = store.get(COOKIE_CARRITO)?.value;
  if (!crudo) return [];
  try {
    const data = JSON.parse(crudo);
    if (!Array.isArray(data)) return [];
    const items = [];
    for (const l of data) {
      const cantidad = normalizarCantidad(l?.cantidad);
      if (typeof l?.id_producto === "string" && UUID.test(l.id_producto) && cantidad) {
        items.push({ id_producto: l.id_producto, cantidad });
      }
    }
    return items.slice(0, MAX_LINEAS);
  } catch {
    return [];
  }
}

export async function guardarCarrito(items) {
  const store = await cookies();
  if (items.length === 0) {
    store.delete(COOKIE_CARRITO);
    return;
  }
  store.set(COOKIE_CARRITO, JSON.stringify(items), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function contarUnidades() {
  const items = await leerCarrito();
  return items.reduce((acc, l) => acc + l.cantidad, 0);
}

// Valida el carrito contra la base (precio, stock, disponibilidad) con fn_tienda_carrito_validar.
export async function validarCarrito(supabase, items) {
  if (items.length === 0) return { lineas: [], error: false };
  const { data, error } = await supabase.rpc("fn_tienda_carrito_validar", {
    p_items: items.map((l) => ({ id_producto: l.id_producto, cantidad: l.cantidad })),
  });
  if (error) return { lineas: [], error: true };
  return { lineas: data ?? [], error: false };
}
