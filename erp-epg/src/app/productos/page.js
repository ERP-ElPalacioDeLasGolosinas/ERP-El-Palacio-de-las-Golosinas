import Link from "next/link";
import { listarProductos } from "@/lib/productos/actions";
import { ProductosTable } from "@/components/productos/ProductosTable";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Artículos | Palacio · ERP",
};

export default async function ProductosPage() {
  const { data, error } = await listarProductos();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[
          { label: "Inicio", href: "/" },
          { label: "Artículos" },
        ]}
        title="Catálogo de artículos"
        description="Alta y consulta de artículos del catálogo (A-05)."
        actions={
          <Link href="/productos/nuevo" className="btn-primary inline-flex">
            Nuevo artículo
          </Link>
        }
      />

      {error ? (
        <div className="card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudieron cargar los artículos</p>
          <p className="mt-1 text-amber-900/80">{error}</p>
          <p className="mt-2 text-amber-900/70">
            Si el mensaje menciona RLS o permisos,{" "}
            <Link href="/login" className="font-medium underline">
              iniciá sesión
            </Link>{" "}
            con un usuario de Supabase Auth. Si habla de relación o columna
            inexistente, aplicá la migración{" "}
            <code className="rounded bg-amber-100 px-1">
              20260825120000_a05_producto_catalogo.sql
            </code>
            .
          </p>
        </div>
      ) : (
        <ProductosTable productos={data ?? []} />
      )}
    </div>
  );
}
