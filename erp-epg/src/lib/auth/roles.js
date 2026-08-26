import { createClient } from "@/lib/supabase/server";

export const PERMISOS = {
  Gerente: ["ver_todo", "editar_todo", "gestionar_usuarios"],
  "Empleado Compras": ["ver_compras", "crear_compra"],
  "Empleado Ventas": ["ver_ventas", "crear_venta"],
  "Empleado Deposito": ["ver_stock", "editar_stock"],
};

export function hasPermission(rol, permiso) {
  return Boolean(PERMISOS[rol]?.includes(permiso));
}

export async function getUserWithRole() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: usuario, error } = await supabase
    .from("usuario")
    .select("id_usuario, nombre_usuario, apellido_usuario, rol_usuario")
    .eq("id_usuario", user.id)
    .single();

  if (error || !usuario) return null;

  return {
    id: usuario.id_usuario,
    email: user.email,
    nombre: usuario.nombre_usuario,
    apellido: usuario.apellido_usuario,
    rol: usuario.rol_usuario,
  };
}
