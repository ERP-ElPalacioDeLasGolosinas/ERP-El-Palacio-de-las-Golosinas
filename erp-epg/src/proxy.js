import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { reescribirConSesion } from "@/lib/supabase/tienda-session";

const PREFIJO_TIENDA = "/tienda";

export async function proxy(request) {
  const host = request.headers.get("host") ?? "";
  const { pathname } = request.nextUrl;
  const enSubdominioTienda = host.startsWith("tienda.");
  const apuntaATienda =
    pathname === PREFIJO_TIENDA || pathname.startsWith(`${PREFIJO_TIENDA}/`);

  // El ERP no sirve la tienda: /tienda/* solo existe como destino interno del rewrite.
  if (!enSubdominioTienda && apuntaATienda) {
    return NextResponse.rewrite(new URL("/no-encontrado", request.url));
  }

  if (enSubdominioTienda) {
    // La tienda no abre rutas del ERP ni el prefijo interno directamente.
    const destino = new URL(request.url);
    destino.pathname = apuntaATienda
      ? "/no-encontrado"
      : `${PREFIJO_TIENDA}${pathname === "/" ? "" : pathname}`;
    if (apuntaATienda) return NextResponse.rewrite(destino);
    return await reescribirConSesion(request, destino);
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
