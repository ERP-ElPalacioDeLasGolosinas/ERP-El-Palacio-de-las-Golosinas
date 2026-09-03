import Link from "next/link";
import { getUserWithRole } from "@/lib/auth/roles";
import { PageHeader } from "@/components/layout/PageHeader";

const MODULOS = [
  {
    href: "/inventario/productos",
    titulo: "Inventario",
    descripcion:
      "Productos, marcas, stock, movimientos y depósitos.",
  },
  {
    href: "/catalogo/unidades-medida",
    titulo: "Catálogo",
    descripcion: "Unidades de medida, rubros y categorías.",
  },
  {
    href: "/compras/proveedores",
    titulo: "Compras",
    descripcion: "Proveedores y comprobantes de proveedor.",
  },
  {
    href: "/tesoreria/cuentas",
    titulo: "Tesorería",
    descripcion: "Cuentas, órdenes de pago y medios de pago.",
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

      <div className="grid gap-4 sm:grid-cols-2">
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
