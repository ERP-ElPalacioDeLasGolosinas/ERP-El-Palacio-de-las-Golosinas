"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { completarRegistroWeb } from "@/lib/tienda/registro";

// Solo se vuelve a rutas internas conocidas (evita redirecciones abiertas).
const destinoPostIngreso = (formData) => {
  const next = formData.get("next");
  return next === "/checkout" || next === "/carrito" ? `/tienda${next}` : "/tienda";
};

export async function registrarClienteWeb(_prevState, formData) {
  const campo = (n) => String(formData.get(n) ?? "").trim();
  const email = campo("email");
  const password = String(formData.get("password") ?? "");
  // DNI/CUIT, teléfono y dirección se piden recién en el checkout (S5-16d).
  const datos = { nombre: campo("nombre") };

  if (!email || !datos.nombre) {
    return { error: "Completá nombre y email." };
  }
  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: datos },
  });
  if (error) return { error: "No se pudo crear la cuenta. Revisá los datos." };

  // Sin sesión = Supabase exige confirmar el mail; el cliente se crea en el primer ingreso.
  if (!data.session) {
    return { aviso: "Te enviamos un mail para confirmar la cuenta. Después ingresá desde la tienda." };
  }

  const mensaje = await completarRegistroWeb(supabase, data.user);
  if (mensaje) {
    await supabase.auth.signOut();
    return { error: mensaje };
  }

  // Desde el modal no se redirige: el cliente cierra el modal y sigue donde estaba.
  if (formData.get("modal") === "1") return { ok: true };
  redirect(destinoPostIngreso(formData));
}
