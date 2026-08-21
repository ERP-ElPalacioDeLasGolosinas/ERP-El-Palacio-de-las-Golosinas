"use client";

import { useActionState, useMemo, useState } from "react";
import { cambiarEstadoUnidadMedida } from "./actions";
import UnidadMedidaForm from "./unidad-medida-form";

const ESTADOS = [
  { value: "activas", label: "Activas" },
  { value: "inactivas", label: "Inactivas" },
  { value: "todas", label: "Todas" },
];

const inputClass =
  "rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft";

export default function UnidadesMedidaClient({ unidades }) {
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("activas");
  const [formTarget, setFormTarget] = useState(null);

  const unidadesFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return unidades.filter((unidad) => {
      if (estado === "activas" && !unidad.activo) return false;
      if (estado === "inactivas" && unidad.activo) return false;
      if (texto && !unidad.nombre_unidad_medida.toLowerCase().includes(texto)) {
        return false;
      }
      return true;
    });
  }, [unidades, busqueda, estado]);

  return (
    <div className="flex flex-1 flex-col gap-4 bg-page p-6 [color-scheme:light]">
      <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-ink">Unidades de medida</h1>
          <button
            type="button"
            onClick={() => setFormTarget("nueva")}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-ink shadow-sm transition hover:bg-accent-strong"
          >
            + Nueva unidad
          </button>
        </div>

        <div className="mt-6 flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="busqueda" className="text-sm font-medium text-ink">
              Buscar por nombre
            </label>
            <input
              id="busqueda"
              type="text"
              placeholder="Nombre de la unidad..."
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="estado" className="text-sm font-medium text-ink">
              Estado
            </label>
            <select
              id="estado"
              value={estado}
              onChange={(event) => setEstado(event.target.value)}
              className={inputClass}
            >
              {ESTADOS.map((opcion) => (
                <option key={opcion.value} value={opcion.value}>
                  {opcion.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <table className="mt-6 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Nombre
              </th>
              <th className="py-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Abreviatura
              </th>
              <th className="py-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Estado
              </th>
              <th className="py-2 text-right text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {unidadesFiltradas.map((unidad) => (
              <FilaUnidadMedida
                key={unidad.id_unidad_medida}
                unidad={unidad}
                onEditar={() => setFormTarget(unidad)}
              />
            ))}
            {unidadesFiltradas.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-ink-muted">
                  No hay unidades de medida para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {formTarget !== null && (
        <UnidadMedidaForm
          key={formTarget === "nueva" ? "nueva" : formTarget.id_unidad_medida}
          unidad={formTarget === "nueva" ? null : formTarget}
          onClose={() => setFormTarget(null)}
        />
      )}
    </div>
  );
}

const initialToggleState = { error: null };

function FilaUnidadMedida({ unidad, onEditar }) {
  const [state, action, pending] = useActionState(
    cambiarEstadoUnidadMedida,
    initialToggleState
  );

  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-3 text-ink">{unidad.nombre_unidad_medida}</td>
      <td className="py-3 text-ink">{unidad.abreviatura_unidad_medida}</td>
      <td className="py-3 text-ink">{unidad.activo ? "Activa" : "Inactiva"}</td>
      <td className="py-3">
        <div className="flex items-center justify-end gap-3">
          {state.error && (
            <span role="alert" className="text-primary">
              {state.error}
            </span>
          )}
          <button
            type="button"
            onClick={onEditar}
            className="text-sm font-medium text-primary hover:underline"
          >
            Editar
          </button>
          <form action={action}>
            <input type="hidden" name="id" value={unidad.id_unidad_medida} />
            <input
              type="hidden"
              name="activo"
              value={(!unidad.activo).toString()}
            />
            <button
              type="submit"
              disabled={pending}
              className="text-sm font-medium text-ink-muted hover:text-ink hover:underline disabled:opacity-60"
            >
              {unidad.activo ? "Inhabilitar" : "Rehabilitar"}
            </button>
          </form>
        </div>
      </td>
    </tr>
  );
}
