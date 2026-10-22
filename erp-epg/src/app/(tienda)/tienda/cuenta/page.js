import { createClient } from "@/lib/supabase/server";
import { obtenerClienteWeb } from "@/lib/tienda/registro";

export const metadata = { title: "Mi cuenta — El Palacio de las Golosinas" };

export default async function CuentaResumen() {
  const supabase = await createClient();
  const cliente = await obtenerClienteWeb(supabase);

  const datos = [
    ["Nombre", cliente.nombre_cliente],
    ["Email", cliente.mail_cliente],
    ["Documento", cliente.documento_cliente],
    ["Teléfono", cliente.telefono_cliente],
    ["Dirección", cliente.direccion_cliente],
  ];

  return (
    <section className="palacio-card p-4">
      <h2 className="text-lg font-semibold">Tus datos</h2>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        {datos.map(([etiqueta, valor]) => (
          <div key={etiqueta}>
            <dt className="text-sm text-palacio-muted">{etiqueta}</dt>
            <dd className="font-medium">{valor || <span className="text-palacio-muted">Sin completar</span>}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
