import { createClient } from "@/lib/supabase/server";
import { obtenerClienteWeb } from "@/lib/tienda/registro";
import { leerFiltros, listarCatalogo, listarFiltros } from "@/lib/tienda/catalogo";
import TiendaHeader from "@/components/tienda/TiendaHeader";
import TiendaFooter from "@/components/tienda/TiendaFooter";
import CatalogoTienda from "@/components/tienda/CatalogoTienda";

export const metadata = { title: "Catálogo — El Palacio de las Golosinas" };

export default async function TiendaCatalogo({ searchParams }) {
  const f = leerFiltros(await searchParams);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [cliente, catalogo, filtros] = await Promise.all([
    user ? obtenerClienteWeb(supabase) : null,
    listarCatalogo(supabase, f),
    listarFiltros(supabase),
  ]);

  return (
    <>
      <TiendaHeader cliente={cliente} q={f.q} />
      <main className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-8 px-4 py-6">
        <CatalogoTienda f={f} filtros={filtros} catalogo={catalogo} />
      </main>
      <TiendaFooter />
    </>
  );
}
