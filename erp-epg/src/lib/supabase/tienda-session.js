import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

// Host de la tienda: refresca el token y reescribe a `destino`, sin redirigir a /login
// (la tienda es pública; el login del cliente web es opcional).
export async function reescribirConSesion(request, destino) {
  let respuesta = NextResponse.rewrite(destino, { request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          respuesta = NextResponse.rewrite(destino, { request });
          cookiesToSet.forEach(({ name, value, options }) =>
            respuesta.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();
  return respuesta;
}
