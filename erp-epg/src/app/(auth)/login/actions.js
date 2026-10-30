"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(_prevState, formData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email y contraseña son obligatorios." };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Empleado inhabilitado desde Usuarios › Gestión (fn_usuario_inhabilitar banea la cuenta).
    if (error.code === "user_banned") {
      return { error: "Tu usuario está inhabilitado. Consultá con el gerente." };
    }
    return { error: "Credenciales inválidas." };
  }

  // Un cliente web (sin fila en `usuario`) no entra al ERP (D-026).
  const { data: esPersonal } = await supabase.rpc("es_personal_erp");
  if (esPersonal !== true) {
    await supabase.auth.signOut();
    return { error: "Credenciales inválidas." };
  }

  redirect("/");
}
