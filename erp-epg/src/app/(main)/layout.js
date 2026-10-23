import { getUserWithRole } from "@/lib/auth/roles";
import { AppShell } from "@/components/layout/AppShell";
import { listarPedidosWeb } from "@/lib/pedidos-web/actions";

export default async function DepositoLayout({ children }) {
  const usuario = await getUserWithRole();

  // Contador del menú: pedidos web pagados o en preparación (S5-20j).
  const [pagados, enPreparacion] = await Promise.all([
    listarPedidosWeb({ estado: "Pagado" }),
    listarPedidosWeb({ estado: "En preparación" }),
  ]);
  const porPreparar = [...(pagados.data ?? []), ...(enPreparacion.data ?? [])].filter(
    (p) => p.a_preparar,
  ).length;

  return (
    <AppShell user={usuario} porPreparar={porPreparar}>
      {children}
    </AppShell>
  );
}
