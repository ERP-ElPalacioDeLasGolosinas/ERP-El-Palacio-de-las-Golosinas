import Link from "next/link";
import { getUserWithRole } from "@/lib/auth/roles";
import { PageHeader } from "@/components/layout/PageHeader";

const MODULOS = [
  {
    href: "/inventario/productos",
    titulo: "Productos",
    descripcion: "Catálogo de productos: alta, edición y precios.",
  },
  {
    href: "/inventario/marcas",
    titulo: "Marcas",
    descripcion: "Gestión de marcas del catálogo.",
  },
  {
    href: "/inventario/stock",
    titulo: "Stock",
    descripcion: "Consultar stock por producto y depósito.",
  },
  {
    href: "/inventario/movimientos",
    titulo: "Movimientos",
    descripcion: "Historial y registro de movimientos de stock.",
  },
  {
    href: "/inventario/depositos",
    titulo: "Depósitos",
    descripcion: "Alta, edición y administración operativa de depósitos.",
  },
  {
    href: "/catalogo/unidades-medida",
    titulo: "Unidades de medida",
    descripcion: "Gestión de unidades de medida del catálogo.",
  },
  {
    href: "/catalogo/rubros",
    titulo: "Rubros",
    descripcion: "Gestión de rubros del catálogo.",
  },
  {
    href: "/catalogo/categorias",
    titulo: "Categorías",
    descripcion: "Gestión de categorías del catálogo.",
  },
];

export default async function Home() {
  const usuario = await getUserWithRole();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        title="Inicio"
        description={
          usuario
            ? `Hola, ${usuario.nombre} ${usuario.apellido}. Elegí un módulo para continuar.`
            : "Elegí un módulo para continuar."
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULOS.map((modulo) => (
          <Link
            key={modulo.href}
            href={modulo.href}
            className="palacio-card flex flex-col gap-1 p-5 transition hover:border-palacio-red/30 hover:shadow-md"
          >
            <span className="text-sm font-semibold text-zinc-900">
              {modulo.titulo}
            </span>
            <span className="text-sm text-palacio-muted">
              {modulo.descripcion}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
