import { getUserWithRole } from "@/lib/auth/roles";
import { AppShell } from "@/components/layout/AppShell";

export default async function DepositoLayout({ children }) {
  const usuario = await getUserWithRole();

  return <AppShell user={usuario}>{children}</AppShell>;
}
