import { agregarAlCarrito } from "@/app/(tienda)/tienda/carrito/actions";

export default function AgregarAlCarrito({ idProducto, conCantidad = false }) {
  return (
    <form action={agregarAlCarrito} className="mt-2 flex items-center gap-2">
      <input type="hidden" name="id_producto" value={idProducto} />
      {conCantidad ? (
        <input
          type="number"
          name="cantidad"
          min="1"
          max="9999"
          defaultValue="1"
          aria-label="Cantidad"
          className="palacio-input w-24"
        />
      ) : (
        <input type="hidden" name="cantidad" value="1" />
      )}
      <button type="submit" className="palacio-btn-primary px-4 py-2 text-sm">
        Agregar al carrito
      </button>
    </form>
  );
}
