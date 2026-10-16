import Link from "next/link";
import AgregarAlCarrito from "@/components/tienda/AgregarAlCarrito";

const precioFmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

const FONDOS = [
  "from-[#ffe1e3] to-[#ffc2c7]",
  "from-[#fff1c7] to-[#ffe08a]",
  "from-[#e9dcff] to-[#d2bcff]",
  "from-[#d8f5e3] to-[#b5ebc9]",
  "from-[#ffe6d1] to-[#ffcba3]",
];
const EMOJIS = ["🍬", "🍭", "🍫", "🧁", "🍪", "🍩"];

export function descuentoPct(p) {
  return Math.round((1 - Number(p.precio) / Number(p.precio_lista)) * 100);
}

// Hash estable para que cada producto conserve su color/ícono entre renders.
function hash(id) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

export default function TarjetaProducto({ producto: p, enFila = false }) {
  const agotado = Number(p.stock_disponible) <= 0;
  const h = hash(p.id_producto);

  return (
    <li
      className={`palacio-card flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md ${
        enFila ? "w-56 shrink-0 snap-start sm:w-60" : ""
      }`}
    >
      <Link
        href={`/producto/${p.id_producto}`}
        className={`relative flex aspect-square items-center justify-center bg-gradient-to-br ${FONDOS[h % FONDOS.length]}`}
        aria-label={p.nombre_producto}
      >
        {p.imagen_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.imagen_url} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
        ) : (
          <span aria-hidden="true" className="text-7xl drop-shadow-sm">{EMOJIS[h % EMOJIS.length]}</span>
        )}
        {p.en_oferta ? (
          <span className="absolute right-2 top-2 rounded-full bg-palacio-red px-2.5 py-0.5 text-xs font-bold text-white shadow">
            -{descuentoPct(p)}%
          </span>
        ) : null}
        {agotado ? (
          <span className="absolute left-2 top-2 rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-semibold text-white">
            Agotado
          </span>
        ) : null}
      </Link>
      <div className="flex flex-1 flex-col gap-0.5 p-3">
        <span className="text-xs font-medium uppercase tracking-wide text-palacio-muted">{p.nombre_marca}</span>
        <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-snug">
          <Link href={`/producto/${p.id_producto}`}>{p.nombre_producto}</Link>
        </h3>
        <span className="text-xs text-palacio-muted">{p.presentacion}</span>
        <span className="mt-1 flex flex-wrap items-baseline gap-2">
          <span className="text-xl font-extrabold text-palacio-red">{precioFmt.format(p.precio)}</span>
          {p.en_oferta ? (
            <span className="text-sm text-palacio-muted line-through">{precioFmt.format(p.precio_lista)}</span>
          ) : null}
        </span>
        {agotado ? (
          <span className="mt-2 text-sm font-medium text-zinc-500">Sin stock por el momento</span>
        ) : (
          <AgregarAlCarrito idProducto={p.id_producto} />
        )}
      </div>
    </li>
  );
}
