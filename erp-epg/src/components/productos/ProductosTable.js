"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  eliminarProducto,
  habilitarProducto,
  inhabilitarProducto,
} from "@/lib/productos/actions";
import { ProductoFormModal } from "./ProductoFormModal";

const fechaFmt = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const monedaFmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

function formatFecha(valor) {
  if (!valor) return "—";
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? "—" : fechaFmt.format(d);
}

function formatMoneda(valor) {
  const n = Number(valor ?? 0);
  return Number.isFinite(n) ? monedaFmt.format(n) : "—";
}

/**
 * @param {{
 *   productos: Array<Record<string, any>>,
 *   marcas: Array<{ id_marca: string, nombre_marca: string }>,
 *   categorias: Array<{ id_categoria: string, nombre_categoria: string, nombre_rubro: string }>,
 *   rubros: Array<{ id_rubro: string, nombre_rubro: string }>,
 *   unidades: Array<{ id_unidad_medida: string, nombre: string, abreviatura: string }>,
 *   incluirInactivos: boolean,
 * }} props
 */
export function ProductosTable({
  productos,
  marcas,
  categorias,
  rubros,
  unidades,
  incluirInactivos,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [busqueda, setBusqueda] = useState("");
  const [filtroMarca, setFiltroMarca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroRubro, setFiltroRubro] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [enEdicion, setEnEdicion] = useState(null);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return productos.filter((p) => {
      if (filtroMarca && p.id_marca !== filtroMarca) return false;
      if (filtroCategoria && p.id_categoria !== filtroCategoria) return false;
      if (filtroRubro && p.id_rubro !== filtroRubro) return false;
      if (q) {
        const enNombre = String(p.nombre_completo ?? p.nombre_producto ?? "")
          .toLowerCase()
          .includes(q);
        const enCodigo = String(p.codigo_producto ?? "")
          .toLowerCase()
          .includes(q);
        if (!enNombre && !enCodigo) return false;
      }
      return true;
    });
  }, [productos, busqueda, filtroMarca, filtroCategoria, filtroRubro]);

  function toggleInactivos(checked) {
    const params = new URLSearchParams(searchParams);
    if (checked) params.set("inactivos", "1");
    else params.delete("inactivos");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function abrirAlta() {
    setEnEdicion(null);
    setModalAbierto(true);
  }

  function abrirEdicion(producto) {
    setEnEdicion(producto);
    setModalAbierto(true);
  }

  function manejarErrorAccion(result) {
    window.alert(result.error);
    if (result.code === "PRD04") router.refresh();
  }

  function toggleActivo(producto) {
    startTransition(async () => {
      const result = producto.activo
        ? await inhabilitarProducto(producto.id_producto)
        : await habilitarProducto(producto.id_producto);
      if (!result.ok) {
        manejarErrorAccion(result);
        return;
      }
      router.refresh();
    });
  }

  function eliminar(producto) {
    const confirmado = window.confirm(
      `¿Eliminar el producto "${producto.nombre_completo ?? producto.nombre_producto}"? Esta acción no se puede deshacer.`
    );
    if (!confirmado) return;

    startTransition(async () => {
      const result = await eliminarProducto(producto.id_producto);
      if (!result.ok) {
        // PRD09: tiene compras / movimientos; el mensaje trae la cantidad.
        manejarErrorAccion(result);
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o código"
          className="palacio-input max-w-xs"
        />
        <select
          value={filtroMarca}
          onChange={(e) => setFiltroMarca(e.target.value)}
          className="palacio-input max-w-[12rem]"
          aria-label="Filtrar por marca"
        >
          <option value="">Todas las marcas</option>
          {marcas.map((m) => (
            <option key={m.id_marca} value={m.id_marca}>
              {m.nombre_marca}
            </option>
          ))}
        </select>
        <select
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
          className="palacio-input max-w-[12rem]"
          aria-label="Filtrar por categoría"
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.id_categoria} value={c.id_categoria}>
              {c.nombre_categoria}
            </option>
          ))}
        </select>
        <select
          value={filtroRubro}
          onChange={(e) => setFiltroRubro(e.target.value)}
          className="palacio-input max-w-[12rem]"
          aria-label="Filtrar por rubro"
        >
          <option value="">Todos los rubros</option>
          {rubros.map((r) => (
            <option key={r.id_rubro} value={r.id_rubro}>
              {r.nombre_rubro}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={incluirInactivos}
            onChange={(e) => toggleInactivos(e.target.checked)}
            className="size-4 accent-palacio-red"
          />
          Incluir inactivos
        </label>
        <button
          type="button"
          onClick={abrirAlta}
          className="palacio-btn-primary ml-auto inline-flex px-4 py-2.5 text-sm"
        >
          Nuevo producto
        </button>
      </div>

      {filtrados.length === 0 ? (
        <div className="palacio-card px-6 py-12 text-center">
          <p className="text-sm text-palacio-muted">
            {productos.length === 0
              ? "No hay productos cargados."
              : "Ningún producto coincide con los filtros."}
          </p>
        </div>
      ) : (
        <div className="palacio-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Listado</h2>
            <span className="text-xs text-palacio-muted">
              {filtrados.length} producto{filtrados.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-palacio-border bg-zinc-50/80">
                  <Th>Código</Th>
                  <Th>Nombre</Th>
                  <Th>Categoría</Th>
                  <Th>Rubro</Th>
                  <Th className="text-right">Costo</Th>
                  <Th className="text-right">P. mayorista</Th>
                  <Th className="text-right">P. minorista</Th>
                  <Th>Creado</Th>
                  <Th>Editado</Th>
                  <Th>Creado por</Th>
                  <Th className="text-center">Estado</Th>
                  <Th className="text-right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => (
                  <tr
                    key={p.id_producto}
                    className={[
                      "border-b border-palacio-border last:border-0",
                      p.activo ? "" : "opacity-60",
                    ].join(" ")}
                  >
                    <td className="px-5 py-4 align-middle">
                      <span className="font-mono text-xs text-zinc-700">
                        {p.codigo_producto}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-middle font-medium text-zinc-900">
                      {p.nombre_completo ?? p.nombre_producto}
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {p.nombre_categoria ?? "Sin categoría"}
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {p.nombre_rubro ?? "Sin rubro"}
                    </td>
                    <td className="px-5 py-4 text-right align-middle tabular-nums text-zinc-700">
                      {formatMoneda(p.costo_producto)}
                    </td>
                    <td className="px-5 py-4 text-right align-middle tabular-nums text-zinc-700">
                      {formatMoneda(p.precio_mayorista_producto)}
                    </td>
                    <td className="px-5 py-4 text-right align-middle tabular-nums text-zinc-700">
                      {formatMoneda(p.precio_minorista_producto)}
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {formatFecha(p.creado)}
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {formatFecha(p.editado)}
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {p.creado_por_nombre ??
                        (p.creado_por ? `${p.creado_por.slice(0, 8)}…` : "—")}
                    </td>
                    <td className="px-5 py-4 text-center align-middle">
                      <span
                        className={
                          p.activo
                            ? "palacio-badge-activo"
                            : "palacio-badge-inactivo"
                        }
                      >
                        {p.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => abrirEdicion(p)}
                          className="palacio-action-btn palacio-action-primary"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => toggleActivo(p)}
                          className="palacio-action-btn"
                        >
                          {p.activo ? "Inhabilitar" : "Habilitar"}
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => eliminar(p)}
                          className="palacio-action-btn palacio-action-danger"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalAbierto ? (
        <ProductoFormModal
          key={enEdicion?.id_producto ?? "nuevo"}
          onClose={() => setModalAbierto(false)}
          producto={enEdicion}
          marcas={marcas}
          categorias={categorias}
          unidades={unidades}
        />
      ) : null}
    </>
  );
}

function Th({ children, className = "" }) {
  return (
    <th
      className={`px-5 py-3 text-[11px] font-semibold tracking-wider text-palacio-muted uppercase ${className}`}
    >
      {children}
    </th>
  );
}
