import Link from "next/link";
import { contarUnidades } from "@/lib/tienda/carrito";

export default async function CarritoLink() {
  const unidades = await contarUnidades();
  return (
    <Link href="/carrito">Carrito{unidades > 0 ? ` (${unidades})` : ""}</Link>
  );
}
