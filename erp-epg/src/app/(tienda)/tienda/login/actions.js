"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { completarRegistroWeb, obtenerClienteWeb } from "@/lib/tienda/registro";

const CREDENCIALES = "Credenciales inválidas.";

// Solo se vuelve a rutas internas conocidas (evita redirecciones abiertas).
const destinoPostIngreso = (formData) =>
  formData.get("next") === "/checkout" ? "/checkout" : "/";

export async function loginTienda(_prevState, formData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email y contraseña son obligatorios." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data?.user) return { error: CREDENCIALES };

  // El personal del ERP entra por el ERP, no por la tienda.
  const { data: esPersonal } = await supabase.rpc("es_personal_erp");
  if (esPersonal === true) {
    await supabase.auth.signOut();
    return { error: CREDENCIALES };
  }

  // Cuenta confirmada por mail sin cliente todavía: se completa con los datos del alta.
  if (!(await obtenerClienteWeb(supabase))) {
    const mensaje = await completarRegistroWeb(supabase, data.user);
    if (mensaje) {
      await supabase.auth.signOut();
      return { error: mensaje };
    }
  }

  redirect(destinoPostIngreso(formData));
}
