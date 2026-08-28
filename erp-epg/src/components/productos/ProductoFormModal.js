"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  actualizarProducto,
  crearProducto,
  validarCodigoUnicoProducto,
} from "@/lib/productos/actions";

const CAMPO_POR_CODIGO = {
  PRD01: "nombre_producto",
  PRD02: "codigo_producto",
  PRD03: "codigo_producto",
  PRD05: "id_marca",
  PRD06: "id_categoria",
  PRD07: "id_unidad_medida",
  PRD08: "numero_medida",
};

/**
 * Modal reutilizable para alta y edición de productos.
 *
 * @param {{
 *   onClose: () => void,
 *   producto?: Record<string, any> | null,
 *   marcas: Array<{ id_marca: string, nombre_marca: string }>,
 *   categorias: Array<{ id_categoria: string, nombre_categoria: string, nombre_rubro: string }>,
 *   unidades: Array<{ id_unidad_medida: string, nombre: string, abreviatura: string }>,
 * }} props
 */
export function ProductoFormModal({
  onClose,
  producto = null,
  marcas,
  categorias,
  unidades,
}) {
  const router = useRouter();
  const isEdit = Boolean(producto?.id_producto);
  const [pending, startTransition] = useTransition();
  const nombreRef = useRef(null);

  const [form, setForm] = useState(() => ({
    id_marca: producto?.id_marca ?? "",
    nombre_producto: producto?.nombre_producto ?? "",
    descripcion_producto: producto?.descripcion_producto ?? "",
    codigo_producto: producto?.codigo_producto ?? "",
    id_unidad_medida: producto?.id_unidad_medida ?? "",
    numero_medida:
      producto?.numero_medida != null ? String(producto.numero_medida) : "",
    id_categoria: producto?.id_categoria ?? "",
    costo_producto:
      producto?.costo_producto != null ? String(producto.costo_producto) : "",
    precio_mayorista_producto:
      producto?.precio_mayorista_producto != null
        ? String(producto.precio_mayorista_producto)
        : "",
    precio_minorista_producto:
      producto?.precio_minorista_producto != null
        ? String(producto.precio_minorista_producto)
        : "",
  }));
  const [errores, setErrores] = useState({});
  const [errorServer, setErrorServer] = useState(null);
  const [codigoAviso, setCodigoAviso] = useState(null);

  useEffect(() => {
    nombreRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function set(campo, valor) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
    setErrores((prev) => ({ ...prev, [campo]: null }));
  }

  async function chequearCodigo() {
    const codigo = form.codigo_producto.trim();
    if (codigo === "") {
      setCodigoAviso(null);
      return;
    }
    const { disponible } = await validarCodigoUnicoProducto(
      codigo,
      producto?.id_producto ?? null
    );
    setCodigoAviso(
      disponible ? null : "Ya existe un producto con este código."
    );
  }

  function validar() {
    const next = {};
    if (form.nombre_producto.trim() === "")
      next.nombre_producto = "El nombre es obligatorio.";
    if (form.descripcion_producto.trim() === "")
      next.descripcion_producto = "La descripción es obligatoria.";
    if (form.codigo_producto.trim() === "")
      next.codigo_producto = "El código es obligatorio.";
    if (!form.id_marca) next.id_marca = "Elegí una marca.";
    if (!form.id_unidad_medida)
      next.id_unidad_medida = "Elegí una unidad de medida.";
    const nm = Number(form.numero_medida);
    if (form.numero_medida.trim() === "" || !Number.isFinite(nm) || nm <= 0)
      next.numero_medida = "Ingresá un número mayor a 0.";
    for (const campo of [
      "costo_producto",
      "precio_mayorista_producto",
      "precio_minorista_producto",
    ]) {
      const v = form[campo].trim();
      if (v !== "" && (!Number.isFinite(Number(v)) || Number(v) < 0)) {
        next[campo] = "Debe ser un número ≥ 0.";
      }
    }
    setErrores(next);
    return Object.keys(next).length === 0;
  }

  function onSubmit(e) {
    e.preventDefault();
    setErrorServer(null);
    if (!validar()) return;

    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.set(k, v));

    startTransition(async () => {
      const result = isEdit
        ? await actualizarProducto(producto.id_producto, fd)
        : await crearProducto(fd);

      if (!result.ok) {
        const campo = result.code ? CAMPO_POR_CODIGO[result.code] : null;
        if (campo) {
          setErrores((prev) => ({ ...prev, [campo]: result.error }));
        } else {
          setErrorServer(result.error);
        }
        if (result.code === "PRD04") router.refresh();
        return;
      }

      onClose();
      router.refresh();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="producto-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="palacio-card my-4 w-full max-w-2xl p-5 md:p-6">
        <h2
          id="producto-modal-title"
          className="mb-5 text-sm font-semibold text-zinc-900"
        >
          {isEdit ? "Editar producto" : "Nuevo producto"}
        </h2>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <div className="grid gap-4 md:grid-cols-2">
            <Campo label="Marca" error={errores.id_marca} requerido>
              <select
                value={form.id_marca}
                onChange={(e) => set("id_marca", e.target.value)}
                className="palacio-input"
              >
                <option value="">Seleccioná una marca…</option>
                {marcas.map((m) => (
                  <option key={m.id_marca} value={m.id_marca}>
                    {m.nombre_marca}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo
              label="Unidad de medida"
              error={errores.id_unidad_medida}
              requerido
            >
              <select
                value={form.id_unidad_medida}
                onChange={(e) => set("id_unidad_medida", e.target.value)}
                className="palacio-input"
              >
                <option value="">Seleccioná una unidad…</option>
                {unidades.map((u) => (
                  <option key={u.id_unidad_medida} value={u.id_unidad_medida}>
                    {u.nombre} ({u.abreviatura})
                  </option>
                ))}
              </select>
            </Campo>

            <Campo label="Nombre" error={errores.nombre_producto} requerido>
              <input
                ref={nombreRef}
                type="text"
                value={form.nombre_producto}
                onChange={(e) => set("nombre_producto", e.target.value)}
                className="palacio-input"
                placeholder="Ej. Alfajor Triple"
                maxLength={120}
              />
            </Campo>

            <Campo label="Número de medida" error={errores.numero_medida} requerido>
              <input
                type="number"
                step="any"
                min="0"
                value={form.numero_medida}
                onChange={(e) => set("numero_medida", e.target.value)}
                className="palacio-input"
                placeholder="Ej. 25"
              />
            </Campo>

            <Campo
              label="Código"
              error={errores.codigo_producto}
              aviso={codigoAviso}
              requerido
            >
              <input
                type="text"
                value={form.codigo_producto}
                onChange={(e) => {
                  set("codigo_producto", e.target.value);
                  setCodigoAviso(null);
                }}
                onBlur={chequearCodigo}
                className="palacio-input font-mono"
                placeholder="Ej. ALF-HAV-25"
                maxLength={60}
                autoComplete="off"
              />
            </Campo>

            <Campo label="Categoría (opcional)" error={errores.id_categoria}>
              <select
                value={form.id_categoria}
                onChange={(e) => set("id_categoria", e.target.value)}
                className="palacio-input"
              >
                <option value="">Sin categoría</option>
                {categorias.map((c) => (
                  <option key={c.id_categoria} value={c.id_categoria}>
                    {c.nombre_categoria}
                    {c.nombre_rubro ? ` — ${c.nombre_rubro}` : ""}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo
              label="Descripción"
              error={errores.descripcion_producto}
              requerido
              full
            >
              <textarea
                value={form.descripcion_producto}
                onChange={(e) => set("descripcion_producto", e.target.value)}
                className="palacio-input min-h-16 resize-y"
                placeholder="Descripción del producto"
                maxLength={500}
              />
            </Campo>

            <Campo label="Costo" error={errores.costo_producto}>
              <input
                type="number"
                step="any"
                min="0"
                value={form.costo_producto}
                onChange={(e) => set("costo_producto", e.target.value)}
                className="palacio-input"
                placeholder="0"
              />
            </Campo>

            <Campo
              label="Precio mayorista"
              error={errores.precio_mayorista_producto}
            >
              <input
                type="number"
                step="any"
                min="0"
                value={form.precio_mayorista_producto}
                onChange={(e) =>
                  set("precio_mayorista_producto", e.target.value)
                }
                className="palacio-input"
                placeholder="0"
              />
            </Campo>

            <Campo
              label="Precio minorista"
              error={errores.precio_minorista_producto}
            >
              <input
                type="number"
                step="any"
                min="0"
                value={form.precio_minorista_producto}
                onChange={(e) =>
                  set("precio_minorista_producto", e.target.value)
                }
                className="palacio-input"
                placeholder="0"
              />
            </Campo>
          </div>

          {errorServer ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorServer}
            </p>
          ) : null}

          <div className="mt-1 flex flex-wrap gap-2 border-t border-palacio-border pt-4">
            <button
              type="submit"
              disabled={pending}
              className="palacio-btn-primary px-4 py-2.5 text-sm"
            >
              {pending
                ? "Guardando…"
                : isEdit
                  ? "Guardar cambios"
                  : "Crear producto"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="palacio-btn-secondary px-4 py-2.5 text-sm"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Campo({ label, error, aviso, requerido = false, full = false, children }) {
  return (
    <div className={`flex flex-col gap-1.5 ${full ? "md:col-span-2" : ""}`}>
      <label className="text-sm font-medium text-zinc-800">
        {label} {requerido ? <span className="text-palacio-red">*</span> : null}
      </label>
      {children}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {!error && aviso ? (
        <p className="text-xs text-amber-700">{aviso}</p>
      ) : null}
    </div>
  );
}
