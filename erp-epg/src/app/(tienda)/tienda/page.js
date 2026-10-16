import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { obtenerClienteWeb } from "@/lib/tienda/registro";
import { leerFiltros, listarCatalogo, listarFiltros } from "@/lib/tienda/catalogo";
import { BANNERS } from "@/lib/tienda/banners";
import TiendaHeader from "@/components/tienda/TiendaHeader";
import TiendaFooter from "@/components/tienda/TiendaFooter";
import HeroCarrusel from "@/components/tienda/HeroCarrusel";
import FilaCarrusel from "@/components/tienda/FilaCarrusel";
import CatalogoTienda, { RUTA_CATALOGO } from "@/components/tienda/CatalogoTienda";
import TarjetaProducto from "@/components/tienda/TarjetaProducto";

export const metadata = { title: "Tienda — El Palacio de las Golosinas" };

const ITEMS_POR_FILA = 12;

function SeccionFila({ id, titulo, href, fondo, items }) {
  return (
    <section id={id} aria-labelledby={`titulo-${id}`} className={`scroll-mt-24 ${fondo ?? ""}`}>
      <div className="mb-3 flex items-end justify-between">
        <h2 id={`titulo-${id}`} className="text-xl font-extrabold tracking-tight">{titulo}</h2>
        {href ? (
          <Link href={href} className="text-sm font-semibold text-palacio-red hover:underline">Ver todos →</Link>
        ) : null}
      </div>
      <FilaCarrusel etiqueta={titulo}>
        {items.slice(0, ITEMS_POR_FILA).map((p) => (
          <TarjetaProducto key={p.id_producto} producto={p} enFila />
        ))}
      </FilaCarrusel>
    </section>
  );
}

export default async function TiendaInicio({ searchParams }) {
  const sp = await searchParams;
  const f = leerFiltros(sp);

  // Búsquedas, filtros y páginas viven en /catalogo (también los links viejos a "/?q=...").
  if (f.q || f.categoria || f.rubro || f.marca || f.ofertas || f.pagina > 1) {
    const qs = new URLSearchParams(
      Object.entries(sp ?? {}).filter(([, v]) => typeof v === "string")
    ).toString();
    redirect(qs ? `${RUTA_CATALOGO}?${qs}` : RUTA_CATALOGO);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [cliente, catalogo, filtros, ofertas, destacados] = await Promise.all([
    user ? obtenerClienteWeb(supabase) : null,
    listarCatalogo(supabase, f),
    listarFiltros(supabase),
    listarCatalogo(supabase, { ...f, ofertas: true }),
    listarCatalogo(supabase, { ...f, destacados: true }),
  ]);

  return (
    <>
      <TiendaHeader cliente={cliente} />

      <main className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-10 px-4 py-6">
        <HeroCarrusel banners={BANNERS} />

        {ofertas.items.length > 0 ? (
          <SeccionFila
            id="ofertas"
            titulo="🔥 Ofertas"
            href={`${RUTA_CATALOGO}?ofertas=1`}
            fondo="rounded-2xl bg-palacio-red-soft p-4 md:p-6"
            items={ofertas.items}
          />
        ) : null}

        {destacados.items.length > 0 ? (
          <SeccionFila id="destacados" titulo="⭐ Productos destacados" items={destacados.items} />
        ) : null}

        <CatalogoTienda f={f} filtros={filtros} catalogo={catalogo} />
      </main>

      <TiendaFooter />
    </>
  );
}
