"use client";

import { useActionState, useState } from "react";
import {
  cambiarActivoMarca,
  renombrarMarca,
} from "@/app/(dashboard)/marcas/actions";
import Badge from "@/components/ui/Badge";

const ESTADO_INICIAL = { ok: false, error: null };

export default function MarcaRow({ marca }) {
  const [editando, setEditando] = useState(false);
  // Controlado: React 19 resetea los inputs no controlados de un <form action>
  // al terminar la action AUNQUE falle; así no se pierde lo tipeado al
  // recibir un error (p.ej. nombre duplicado).
  const [nombreEdit, setNombreEdit] = useState(marca.nombre_marca);

  const empezarEdicion = () => {
    setNombreEdit(marca.nombre_marca);
    setEditando(true);
  };

  const [renameState, renameAction, renaming] = useActionState(
    async (prev, formData) => {
      const resultado = await renombrarMarca(prev, formData);
      if (resultado.ok) setEditando(false);
      return resultado;
    },
    ESTADO_INICIAL
  );
  const [toggleState, toggleAction, toggling] = useActionState(
    cambiarActivoMarca,
    ESTADO_INICIAL
  );

  const confirmarToggle = (e) => {
    const verbo = marca.activo ? "Desactivar" : "Reactivar";
    if (!confirm(`¿${verbo} la marca "${marca.nombre_marca}"?`)) {
      e.preventDefault();
    }
  };

  if (editando) {
    return (
      <tr className="border-t border-linea bg-ambar-bg/40">
        <td colSpan={5} className="px-4 py-2.5">
          <form action={renameAction} className="flex items-center gap-2.5">
            <input type="hidden" name="id_marca" value={marca.id_marca} />
            <input
              type="text"
              name="nombre_marca"
              value={nombreEdit}
              onChange={(e) => setNombreEdit(e.target.value)}
              maxLength={60}
              required
              autoFocus
              disabled={renaming}
              onKeyDown={(e) => {
                if (e.key === "Escape") setEditando(false);
              }}
              className="min-w-0 flex-1 rounded-[9px] border-[1.5px] border-oro bg-panel px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ambar-bg disabled:opacity-60"
              aria-label={`Nuevo nombre para ${marca.nombre_marca}`}
            />
            <button type="submit" className="btn-primary" disabled={renaming}>
              {renaming ? "Guardando…" : "Guardar"}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setEditando(false)}
              disabled={renaming}
            >
              Cancelar
            </button>
          </form>
          {renameState.error && (
            <p className="mt-1.5 text-[12.5px] font-medium text-rojo" role="alert">
              {renameState.error}
            </p>
          )}
        </td>
      </tr>
    );
  }

  return (
    <tr
      className={`border-t border-linea hover:bg-crema/60 ${
        marca.activo ? "" : "opacity-60"
      }`}
    >
      <td className="px-4 py-3 text-sm font-medium">{marca.nombre_marca}</td>
      <td className="px-4 py-3">
        <Badge activo={marca.activo} />
      </td>
      <td className="px-4 py-3 text-[13px] text-tinta-suave tabular-nums">
        {marca.creado_fmt}
      </td>
      <td className="px-4 py-3 text-[13px] text-tinta-suave">
        {marca.creado_por ?? "—"}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            className="btn-ghost"
            onClick={empezarEdicion}
            disabled={toggling}
          >
            Editar
          </button>
          <form action={toggleAction} onSubmit={confirmarToggle}>
            <input type="hidden" name="id_marca" value={marca.id_marca} />
            <input type="hidden" name="activo" value={String(!marca.activo)} />
            <button
              type="submit"
              className={`btn-ghost ${
                marca.activo ? "text-rojo-hondo" : "text-verde"
              }`}
              disabled={toggling}
            >
              {toggling
                ? "Guardando…"
                : marca.activo
                  ? "Desactivar"
                  : "Reactivar"}
            </button>
          </form>
        </div>
        {toggleState.error && (
          <p
            className="mt-1 text-right text-[11.5px] font-medium text-rojo"
            role="alert"
          >
            {toggleState.error}
          </p>
        )}
      </td>
    </tr>
  );
}
