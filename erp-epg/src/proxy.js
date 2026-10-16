import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { reescribirConSesion } from "@/lib/supabase/tienda-session";

const PREFIJO_TIENDA = "/tienda";

export async function proxy(request) {
  const { pathname } = request.nextUrl;
  const apuntaATienda =
    pathname === PREFIJO_TIENDA || pathname.startsWith(`${PREFIJO_TIENDA}/`);

  // La tienda vive en /tienda del mismo dominio: pública, solo refresca la sesión.
  if (apuntaATienda) {
    return await reescribirConSesion(request, request.nextUrl.clone());
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
