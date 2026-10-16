import { contarUnidades } from "@/lib/tienda/carrito";
import CarritoBoton from "./CarritoBoton";

export default async function CarritoLink() {
  const unidades = await contarUnidades();
  return <CarritoBoton unidades={unidades} />;
}
