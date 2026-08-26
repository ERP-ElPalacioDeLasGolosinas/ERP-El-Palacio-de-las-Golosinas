import Link from "next/link";
import { listarCategorias } from "@/lib/categorias/actions";
import { CategoriasTable } from "@/components/categorias/CategoriasTable";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Categorías | Palacio · ERP",
};

export default async function CategoriasPage() {
  const { data, error } = await listarCategorias();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[
          { label: "Inicio", href: "/" },
          { label: "Artículos y catálogo", href: "/rubros" },
          { label: "Categorías" },
        ]}
        title="Gestionar categorías"
        description="Alta, edición, inhabilitación y baja de categorías del catálogo (segundo nivel, siempre asociadas a un rubro)."
        actions={
          <Link
            href="/categorias/nuevo"
            className="btn-primary inline-flex px-4 py-2.5 text-sm"
          >
            Nueva categoría
          </Link>
        }
      />

      {error ? (
        <div className="card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudieron cargar las categorías</p>
          <p className="mt-1 text-amber-900/80">{error}</p>
          <p className="mt-2 text-amber-900/70">
            Si el mensaje menciona RLS o permisos,{" "}
            <Link href="/login" className="font-medium underline">
              iniciá sesión
            </Link>{" "}
            con un usuario de Supabase Auth (políticas: rol{" "}
            <code className="rounded bg-amber-100 px-1">authenticated</code>
            ). Si habla de relación inexistente, aplicá las migraciones de{" "}
            <code className="rounded bg-amber-100 px-1">rubro</code> y{" "}
            <code className="rounded bg-amber-100 px-1">categoria</code> en
            Supabase.
          </p>
        </div>
      ) : (
        <CategoriasTable categorias={data ?? []} />
      )}
    </div>
  );
}
