import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

const RUTAS_PUBLICAS = ["/login"];

const REGLAS_POR_RUTA = [
  { prefijo: "/compras", roles: ["Empleado Compras", "Gerente"] },
  { prefijo: "/ventas", roles: ["Empleado Ventas", "Gerente"] },
  { prefijo: "/deposito", roles: ["Empleado Deposito", "Gerente"] },
  { prefijo: "/gerencia", roles: ["Gerente"] },
];

export async function updateSession(request) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refreshes the auth token if expired. Required so Server Components can
  // read a valid session — do not add logic between client creation and this call.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const esRutaPublica = RUTAS_PUBLICAS.some((ruta) => pathname.startsWith(ruta));

  if (!user && !esRutaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && esRutaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  const regla = REGLAS_POR_RUTA.find((r) => pathname.startsWith(r.prefijo));

  if (user && regla) {
    const { data: usuario } = await supabase
      .from("usuario")
      .select("rol_usuario")
      .eq("id_usuario", user.id)
      .single();

    if (!usuario || !regla.roles.includes(usuario.rol_usuario)) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
