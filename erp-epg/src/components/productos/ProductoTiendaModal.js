"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { quitarFotoProducto, subirFotoProducto } from "@/lib/productos/foto-cliente";
import {
  destacarProductoTienda,
  eliminarOfertaProducto,
  guardarOfertaProducto,
  obtenerTiendaProducto,
} from "@/lib/productos/actions";

const monedaFmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

/**
 * Foto y ofertas de un artículo para la tienda online.
 * @param {{ producto: Record<string, any>, onClose: () => void }} props
 */
export function ProductoTiendaModal({ producto, onClose }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const inputFoto = useRef(null);
  const nombre = producto.nombre_completo ?? producto.nombre_producto;

  async function cargar() {
    const r = await obtenerTiendaProducto(producto.id_producto);
    if (r.ok) setDatos(r.data);
    else setError(r.error);
  }

  useEffect(() => {
    let vivo = true;
    obtenerTiendaProducto(producto.id_producto).then((r) => {
      if (!vivo) return;
      if (r.ok) setDatos(r.data);
      else setError(r.error);
    });
    return () => {
      vivo = false;
    };
  }, [producto.id_producto]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function subirFoto(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setSubiendo(true);
    try {
      await subirFotoProducto(producto.id_producto, file);
      await cargar();
      router.refresh();
    } catch (err) {
      setError(err.message || "No se pudo subir la foto.");
    } finally {
      setSubiendo(false);
    }
  }

  function quitarFoto() {
    startTransition(async () => {
      try {
        await quitarFotoProducto(producto.id_producto);
        await cargar();
        router.refresh();
      } catch (err) {
        setError(err.message);
      }
    });
  }

  function cambiarDestacado(valor) {
    startTransition(async () => {
      const r = await destacarProductoTienda(producto.id_producto, valor);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setError(null);
      await cargar();
    });
  }

  function agregarOferta(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      const r = await guardarOfertaProducto(producto.id_producto, fd);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setError(null);
      form.reset();
      await cargar();
    });
  }

  function quitarOferta(id) {
    startTransition(async () => {
      const r = await eliminarOfertaProducto(id);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setError(null);
      await cargar();
    });
  }

  const ocupado = pending || subiendo;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Foto y ofertas de ${nombre}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="palacio-card my-8 w-full max-w-xl p-6">
        <h2 className="text-lg font-bold text-zinc-900">Foto y ofertas en la tienda</h2>
        <p className="mt-0.5 text-sm text-palacio-muted">{nombre}</p>

        {error ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        {!datos ? (
          <p className="mt-6 text-sm text-palacio-muted">Cargando…</p>
        ) : (
          <>
            <section className="mt-5">
              <h3 className="text-sm font-semibold text-zinc-900">Foto</h3>
              <div className="mt-2 flex items-center gap-4">
                <div className="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-palacio-border bg-zinc-50 text-3xl">
                  {datos.imagen_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={datos.imagen_url} alt="" className="size-full object-cover" />
                  ) : (
                    <span aria-hidden="true">🍬</span>
                  )}
                </div>
                <div className="flex flex-col items-start gap-2">
                  <input
                    ref={inputFoto}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={subirFoto}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => inputFoto.current?.click()}
                    className="palacio-btn-primary px-4 py-2 text-sm"
                  >
                    {subiendo ? "Subiendo…" : datos.imagen_url ? "Cambiar foto" : "Subir foto"}
                  </button>
                  {datos.imagen_url ? (
                    <button type="button" disabled={ocupado} onClick={quitarFoto} className="palacio-action-btn palacio-action-danger">
                      Quitar foto
                    </button>
                  ) : null}
                  <p className="text-xs text-palacio-muted">JPG, PNG o WebP. Se achica automáticamente.</p>
                </div>
              </div>
            </section>

            <section className="mt-6 border-t border-palacio-border pt-5">
              <label className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                <input
                  type="checkbox"
                  checked={Boolean(datos.destacado_tienda)}
                  disabled={ocupado}
                  onChange={(e) => cambiarDestacado(e.target.checked)}
                  className="size-4 accent-palacio-red"
                />
                Producto destacado en la portada de la tienda
              </label>
            </section>

            <section className="mt-6 border-t border-palacio-border pt-5">
              <h3 className="text-sm font-semibold text-zinc-900">Ofertas</h3>
              <p className="mt-0.5 text-xs text-palacio-muted">
                Precio de lista Minorista:{" "}
                {datos.precio_lista != null ? monedaFmt.format(datos.precio_lista) : "sin precio vigente"}
              </p>

              {datos.ofertas.length > 0 ? (
                <ul className="mt-3 flex flex-col gap-2">
                  {datos.ofertas.map((o) => (
                    <li key={o.id_oferta} className="flex items-center justify-between gap-3 rounded-lg border border-palacio-border px-3 py-2 text-sm">
                      <span>
                        <strong>{monedaFmt.format(o.precio_oferta)}</strong>
                        <span className="ml-2 text-palacio-muted">
                          {o.fecha_inicio.split("-").reverse().join("/")} →{" "}
                          {o.fecha_fin ? o.fecha_fin.split("-").reverse().join("/") : "sin fin"}
                        </span>
                      </span>
                      <button type="button" disabled={ocupado} onClick={() => quitarOferta(o.id_oferta)} className="palacio-action-btn palacio-action-danger">
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-palacio-muted">Sin ofertas cargadas.</p>
              )}

              <form onSubmit={agregarOferta} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                  Precio de oferta
                  <input name="precio_oferta" type="number" step="0.01" min="0.01" required className="palacio-input" />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                  Desde (opcional)
                  <input name="fecha_inicio" type="date" className="palacio-input" />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                  Hasta (opcional)
                  <input name="fecha_fin" type="date" className="palacio-input" />
                </label>
                <button type="submit" disabled={ocupado} className="palacio-btn-primary px-4 py-2 text-sm sm:col-span-3 sm:justify-self-start">
                  Agregar oferta
                </button>
              </form>
            </section>
          </>
        )}

        <div className="mt-6 flex justify-end">
          <button type="button" onClick={onClose} className="palacio-btn-secondary px-4 py-2 text-sm">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
