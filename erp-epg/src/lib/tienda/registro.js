import { mensajeErrorRegistro } from "./errores";

// Crea el `cliente` del usuario autenticado a partir de los datos que dejó en
// `user_metadata` al registrarse (así funciona con y sin confirmación de mail).
// Devuelve null si quedó registrado, o el mensaje de error.
export async function completarRegistroWeb(supabase, user) {
  const meta = user?.user_metadata ?? {};
  const { error } = await supabase.rpc("fn_cliente_web_registrar", {
    p_nombre_cliente: meta.nombre ?? "",
    p_documento_cliente: meta.documento ?? "",
    p_telefono_cliente: meta.telefono ?? "",
    p_direccion_cliente: meta.direccion ?? null,
  });
  return error ? mensajeErrorRegistro(error) : null;
}

// Cliente web de la sesión actual, o null.
export async function obtenerClienteWeb(supabase) {
  const { data } = await supabase.rpc("fn_cliente_web_obtener");
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}
