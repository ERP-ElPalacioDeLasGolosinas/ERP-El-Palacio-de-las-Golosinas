"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { completarRegistroWeb } from "@/lib/tienda/registro";

// Solo se vuelve a rutas internas conocidas (evita redirecciones abiertas).
const destinoPostIngreso = (formData) =>
  formData.get("next") === "/checkout" ? "/checkout" : "/";

export async function registrarClienteWeb(_prevState, formData) {
  const campo = (n) => String(formData.get(n) ?? "").trim();
  const email = campo("email");
  const password = String(formData.get("password") ?? "");
  const datos = {
    nombre: campo("nombre"),
    documento: campo("documento"),
    telefono: campo("telefono"),
    direccion: campo("direccion") || null,
  };

  if (!email || !datos.nombre || !datos.documento || !datos.telefono) {
    return { error: "Completá nombre, documento, teléfono y email." };
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

  redirect(destinoPostIngreso(formData));
}
