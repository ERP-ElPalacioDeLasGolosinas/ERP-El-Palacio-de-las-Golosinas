import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MarcarNotificacionesVistas from "@/components/tienda/MarcarNotificacionesVistas";
import { obtenerClienteWeb } from "@/lib/tienda/registro";
import { textoNotificacion } from "@/lib/tienda/notificaciones";

export const metadata = { title: "Notificaciones — El Palacio de las Golosinas" };

const fechaFmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" });

export default async function Notificaciones() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await obtenerClienteWeb(supabase))) redirect("/tienda/login");

  const { data, error } = await supabase.rpc("fn_cliente_web_notificaciones_listar", { p_limite: 50 });
  const avisos = data ?? [];
  const hayNoLeidas = avisos.some((a) => !a.leida);

  return (
    <div>
      <h2 className="text-lg font-semibold">Notificaciones</h2>

      {error ? (
        <p className="mt-6 text-palacio-muted">No se pudieron cargar tus notificaciones. Probá de nuevo en un rato.</p>
      ) : avisos.length === 0 ? (
        <p className="mt-6 text-palacio-muted">No tenés notificaciones.</p>
      ) : (
        <ul className="palacio-card mt-4 divide-y divide-zinc-200">
          {avisos.map((a) => (
            <li key={a.id_historial} className={`p-4 ${a.leida ? "" : "bg-palacio-bg"}`}>
              <p className={a.leida ? "" : "font-semibold"}>{textoNotificacion(a.estado)}</p>
              <p className="mt-1 text-sm text-palacio-muted">
                <Link href={`/tienda/cuenta/pedidos/${a.id_pedido}`} className="hover:text-palacio-red">
                  Pedido N° {a.numero}
                </Link>{" "}
                · {fechaFmt.format(new Date(a.fecha))}
              </p>
            </li>
          ))}
        </ul>
      )}

      {hayNoLeidas && <MarcarNotificacionesVistas />}
    </div>
  );
}
