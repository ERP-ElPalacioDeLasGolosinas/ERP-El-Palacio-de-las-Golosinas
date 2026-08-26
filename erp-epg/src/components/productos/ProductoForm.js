"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { crearProducto } from "@/lib/productos/actions";

const initialState = { ok: false, error: null };

/**
 * @param {{
 *   marcas: Array<{ id_marca: string, nombre_marca: string }>,
 *   unidadesMedida: Array<{ id_unidad_medida: string, nombre_unidad_medida: string, abreviatura_unidad_medida: string }>,
 *   categorias: Array<{ id_categoria: string, nombre_categoria: string, id_rubro: string, rubro?: { id_rubro: string, nombre_rubro: string } | null }>,
 * }} props
 */
export function ProductoForm({ marcas, unidadesMedida, categorias }) {
  const router = useRouter();

  const [state, formAction, pending] = useActionState(
    crearProducto,
    initialState
  );

  useEffect(() => {
    if (state?.ok) {
      router.push("/productos");
      router.refresh();
    }
  }, [state, router]);

  const rubros = useMemo(() => {
    const vistos = new Map();
    for (const c of categorias) {
      if (c.rubro && !vistos.has(c.rubro.id_rubro)) {
        vistos.set(c.rubro.id_rubro, c.rubro);
      }
    }
    return Array.from(vistos.values()).sort((a, b) =>
      a.nombre_rubro.localeCompare(b.nombre_rubro)
    );
  }, [categorias]);

  const [idRubro, setIdRubro] = useState("");

  const categoriasFiltradas = useMemo(
    () =>
      idRubro ? categorias.filter((c) => c.id_rubro === idRubro) : categorias,
    [categorias, idRubro]
  );

  const sinDependencias =
    !marcas.length || !unidadesMedida.length || !categorias.length;

  if (sinDependencias) {
    return (
      <div className="card max-w-2xl border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
        <p className="font-medium">Faltan datos previos para dar de alta un artículo</p>
        <ul className="mt-2 list-disc pl-5 text-amber-900/80">
          {!marcas.length ? <li>No hay marcas activas cargadas.</li> : null}
          {!unidadesMedida.length ? (
            <li>No hay unidades de medida activas cargadas.</li>
          ) : null}
          {!categorias.length ? (
            <li>No hay categorías activas cargadas.</li>
          ) : null}
        </ul>
      </div>
    );
  }

  return (
    <form action={formAction} className="card max-w-2xl p-5 md:p-6">
      <h2 className="mb-5 text-sm font-semibold text-ink">Alta de artículo</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="codigo_producto" className="text-sm font-medium text-ink">
            Código <span className="text-primary">*</span>
          </label>
          <input
            id="codigo_producto"
            name="codigo_producto"
            type="text"
            required
            maxLength={50}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft"
            placeholder="Ej. GOL-0001"
          />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="nombre_producto" className="text-sm font-medium text-ink">
            Nombre <span className="text-primary">*</span>
          </label>
          <input
            id="nombre_producto"
            name="nombre_producto"
            type="text"
            required
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft"
            placeholder="Ej. Alfajor Triple"
          />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="descripcion_producto" className="text-sm font-medium text-ink">
            Descripción <span className="text-primary">*</span>
          </label>
          <textarea
            id="descripcion_producto"
            name="descripcion_producto"
            required
            rows={2}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft"
            placeholder="Descripción del artículo"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="id_marca" className="text-sm font-medium text-ink">
            Marca <span className="text-primary">*</span>
          </label>
          <select
            id="id_marca"
            name="id_marca"
            required
            defaultValue=""
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft"
          >
            <option value="" disabled>
              Seleccioná una marca…
            </option>
            {marcas.map((m) => (
              <option key={m.id_marca} value={m.id_marca}>
                {m.nombre_marca}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="id_unidad_medida" className="text-sm font-medium text-ink">
            Unidad de medida <span className="text-primary">*</span>
          </label>
          <select
            id="id_unidad_medida"
            name="id_unidad_medida"
            required
            defaultValue=""
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft"
          >
            <option value="" disabled>
              Seleccioná una unidad…
            </option>
            {unidadesMedida.map((u) => (
              <option key={u.id_unidad_medida} value={u.id_unidad_medida}>
                {u.nombre_unidad_medida} ({u.abreviatura_unidad_medida})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="filtro_rubro" className="text-sm font-medium text-ink">
            Rubro
          </label>
          <select
            id="filtro_rubro"
            value={idRubro}
            onChange={(e) => setIdRubro(e.target.value)}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft"
          >
            <option value="">Todos los rubros</option>
            {rubros.map((r) => (
              <option key={r.id_rubro} value={r.id_rubro}>
                {r.nombre_rubro}
              </option>
            ))}
          </select>
          <p className="text-xs text-ink-muted">
            Filtra la lista de categorías de al lado.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="id_categoria" className="text-sm font-medium text-ink">
            Categoría <span className="text-primary">*</span>
          </label>
          <select
            id="id_categoria"
            name="id_categoria"
            required
            defaultValue=""
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft"
          >
            <option value="" disabled>
              Seleccioná una categoría…
            </option>
            {categoriasFiltradas.map((c) => (
              <option key={c.id_categoria} value={c.id_categoria}>
                {c.nombre_categoria}
                {c.rubro ? ` — ${c.rubro.nombre_rubro}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="precio_costo_producto" className="text-sm font-medium text-ink">
            Precio de costo <span className="text-primary">*</span>
          </label>
          <input
            id="precio_costo_producto"
            name="precio_costo_producto"
            type="number"
            step="0.01"
            min="0"
            required
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft"
            placeholder="0.00"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="precio_venta_mayorista_producto" className="text-sm font-medium text-ink">
            Precio venta mayorista
          </label>
          <input
            id="precio_venta_mayorista_producto"
            name="precio_venta_mayorista_producto"
            type="number"
            step="0.01"
            min="0"
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft"
            placeholder="Opcional"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="precio_venta_sugerido_producto" className="text-sm font-medium text-ink">
            Precio venta sugerido
          </label>
          <input
            id="precio_venta_sugerido_producto"
            name="precio_venta_sugerido_producto"
            type="number"
            step="0.01"
            min="0"
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft"
            placeholder="Opcional"
          />
        </div>
      </div>

      {state?.error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Guardando…" : "Crear artículo"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/productos")}
          className="btn-ghost"
        >
          Volver al listado
        </button>
      </div>
    </form>
  );
}
