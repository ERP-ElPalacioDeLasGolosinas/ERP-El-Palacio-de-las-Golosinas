import { createClient } from "@/lib/supabase/server";
import { obtenerClienteWeb } from "@/lib/tienda/registro";
import TiendaProvider from "@/components/tienda/TiendaProvider";

export default async function TiendaLayout({ children }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const cliente = user ? await obtenerClienteWeb(supabase) : null;

  return <TiendaProvider cliente={cliente}>{children}</TiendaProvider>;
}
