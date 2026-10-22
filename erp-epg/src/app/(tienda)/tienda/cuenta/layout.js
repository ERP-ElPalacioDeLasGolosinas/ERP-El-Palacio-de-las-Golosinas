import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { obtenerClienteWeb } from "@/lib/tienda/registro";
import TiendaHeader from "@/components/tienda/TiendaHeader";
import CuentaNav from "@/components/tienda/CuentaNav";

export default async function CuentaLayout({ children }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/tienda?login=1&next=/cuenta");
  const cliente = await obtenerClienteWeb(supabase);
  if (!cliente) redirect("/tienda");

  return (
    <>
      <TiendaHeader cliente={cliente} />
      <main className="mx-auto max-w-4xl p-6">
        <h1 className="text-2xl font-bold tracking-tight">Mi cuenta</h1>
        <div className="mt-4">
          <CuentaNav />
        </div>
        <div className="mt-6">{children}</div>
      </main>
    </>
  );
}
