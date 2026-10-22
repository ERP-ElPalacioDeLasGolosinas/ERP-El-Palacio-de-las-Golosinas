import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import EstadoTicketBadge from "@/components/tienda/EstadoTicketBadge";

export const metadata = { title: "Soporte — El Palacio de las Golosinas" };

const fechaFmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" });

export default async function CuentaSoporte() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_ticket_mis_listar");
  const tickets = data ?? [];

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Soporte</h2>
        <Link href="/tienda/cuenta/soporte/nuevo" className="palacio-btn-primary px-4 py-2 text-sm">
          Nueva consulta
        </Link>
      </div>

      {error ? (
        <p className="mt-6 text-palacio-muted">No se pudieron cargar tus consultas. Probá de nuevo en un rato.</p>
      ) : tickets.length === 0 ? (
        <p className="mt-6 text-palacio-muted">Todavía no abriste ninguna consulta.</p>
      ) : (
        <ul className="palacio-card mt-4 divide-y divide-zinc-200">
          {tickets.map((t) => (
            <li key={t.id_ticket} className="flex flex-wrap items-baseline justify-between gap-2 p-4">
              <div>
                <Link href={`/tienda/cuenta/soporte/${t.id_ticket}`} className="font-medium">{t.asunto}</Link>
                <p className="text-sm text-palacio-muted">
                  {t.numero_pedido ? `Pedido N° ${t.numero_pedido} · ` : ""}
                  Última actividad {fechaFmt.format(new Date(t.ultima_actividad))}
                </p>
              </div>
              <EstadoTicketBadge estado={t.estado} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
