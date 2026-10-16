import Link from "next/link";
import { TAMANO_PAGINA } from "@/lib/tienda/catalogo";
import FiltrosTienda from "@/components/tienda/FiltrosTienda";
import TarjetaProducto from "@/components/tienda/TarjetaProducto";

export const RUTA_CATALOGO = "/catalogo";

function hrefPagina(f, pagina) {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.categoria) p.set("categoria", f.categoria);
  if (f.rubro) p.set("rubro", f.rubro);
  if (f.marca) p.set("marca", f.marca);
  if (f.ofertas) p.set("ofertas", "1");
  if (pagina > 1) p.set("pagina", String(pagina));
  const qs = p.toString();
  return qs ? `${RUTA_CATALOGO}?${qs}` : RUTA_CATALOGO;
}

// Catálogo con filtros laterales y paginado. Los filtros y las páginas viven en /catalogo.
export default function CatalogoTienda({ f, filtros, catalogo, titulo }) {
  const hayFiltros = Boolean(f.q || f.categoria || f.rubro || f.marca || f.ofertas);
  const totalPaginas = Math.max(1, Math.ceil(catalogo.total / TAMANO_PAGINA));
  const encabezado = titulo ?? (f.ofertas ? "Ofertas" : hayFiltros ? "Resultados" : "Todos los productos");

  return (
    <div id="catalogo" className="grid scroll-mt-24 gap-6 lg:grid-cols-[16rem_1fr]">
      <aside>
        <FiltrosTienda action={RUTA_CATALOGO} filtros={filtros} valores={f} hayFiltros={hayFiltros} />
      </aside>

      <section aria-labelledby="titulo-catalogo">
        <h2 id="titulo-catalogo" className="text-xl font-extrabold tracking-tight">{encabezado}</h2>

        {catalogo.error ? (
          <p className="mt-8 text-palacio-muted">No se pudo cargar el catálogo. Probá de nuevo en un rato.</p>
        ) : catalogo.items.length === 0 ? (
          <div className="palacio-card mt-6 flex flex-col items-center gap-2 p-10 text-center">
            <span aria-hidden="true" className="text-5xl">🍬</span>
            <p className="font-semibold">
              {hayFiltros ? "No hay productos que coincidan con la búsqueda." : "Todavía no hay productos disponibles."}
            </p>
            <p className="text-sm text-palacio-muted">
              {hayFiltros ? "Probá con otros filtros." : "Volvé pronto, estamos cargando el catálogo."}
            </p>
          </div>
        ) : (
          <>
            <p className="mt-3 text-sm text-palacio-muted">
              {catalogo.total} {catalogo.total === 1 ? "producto" : "productos"}
            </p>
            <ul className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-3">
              {catalogo.items.map((p) => (
                <TarjetaProducto key={p.id_producto} producto={p} />
              ))}
            </ul>

            {totalPaginas > 1 ? (
              <nav className="mt-8 flex items-center justify-center gap-4 text-sm" aria-label="Paginado">
                {f.pagina > 1 ? (
                  <Link href={hrefPagina(f, f.pagina - 1)} className="palacio-btn-secondary px-4 py-2">← Anterior</Link>
                ) : <span />}
                <span>Página {Math.min(f.pagina, totalPaginas)} de {totalPaginas}</span>
                {f.pagina < totalPaginas ? (
                  <Link href={hrefPagina(f, f.pagina + 1)} className="palacio-btn-secondary px-4 py-2">Siguiente →</Link>
                ) : <span />}
              </nav>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
