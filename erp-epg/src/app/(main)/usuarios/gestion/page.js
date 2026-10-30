import { redirect } from "next/navigation";
import { getUserWithRole } from "@/lib/auth/roles";
import { listarUsuarios } from "@/lib/usuarios/actions";
import { UsuariosTable } from "@/components/usuarios/UsuariosTable";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Gestión de usuarios | Palacio · ERP",
};

/**
 * Solo Gerente: alta, edición, habilitar/inhabilitar y baja de empleados.
 *
 * @param {{ searchParams: Promise<{ inactivos?: string }> }} props
 */
export default async function GestionUsuariosPage({ searchParams }) {
  const usuario = await getUserWithRole();
  if (usuario?.rol !== "Gerente") redirect("/");

  const sp = await searchParams;
  const incluirInactivos = sp?.inactivos === "1";

  const { data, error } = await listarUsuarios(incluirInactivos);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[{ label: "Usuarios" }, { label: "Gestión" }]}
        title="Gestión de usuarios"
        description="Alta, edición y administración de los empleados de depósito, compras y ventas."
      />

      {error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudieron cargar los usuarios</p>
          <p className="mt-1 text-amber-900/80">{error}</p>
        </div>
      ) : (
        <UsuariosTable usuarios={data ?? []} incluirInactivos={incluirInactivos} />
      )}
    </div>
  );
}
