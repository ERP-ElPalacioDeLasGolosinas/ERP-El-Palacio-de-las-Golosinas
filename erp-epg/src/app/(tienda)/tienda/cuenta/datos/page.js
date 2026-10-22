import DatosCuentaForm from "@/components/tienda/DatosCuentaForm";
import { createClient } from "@/lib/supabase/server";
import { obtenerClienteWeb } from "@/lib/tienda/registro";

export const metadata = { title: "Mis datos — El Palacio de las Golosinas" };

export default async function CuentaDatos() {
  const supabase = await createClient();
  const cliente = await obtenerClienteWeb(supabase);

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Mis datos</h2>
      <DatosCuentaForm cliente={cliente} />
    </section>
  );
}
