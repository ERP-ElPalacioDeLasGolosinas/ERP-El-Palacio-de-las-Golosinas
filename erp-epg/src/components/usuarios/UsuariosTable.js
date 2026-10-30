"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  eliminarUsuario,
  habilitarUsuario,
  inhabilitarUsuario,
} from "@/lib/usuarios/actions";
import { ROL_LABEL, ROLES_EMPLEADO } from "@/lib/usuarios/constantes";
import { UsuarioFormModal } from "./UsuarioFormModal";

const fechaFmt = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatFecha(valor) {
  if (!valor) return "—";
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? "—" : fechaFmt.format(d);
}

/**
 * @param {{
 *   usuarios: Array<{
 *     id_usuario: string,
 *     nombre_usuario: string,
 *     apellido_usuario: string,
 *     nombre_completo: string,
 *     fecha_nacimiento_usuario: string,
 *     dni_usuario: number,
 *     telefono_usuario: string,
 *     mail_usuario: string,
 *     rol_usuario: string,
 *     activo: boolean,
 *     creado: string,
 *     ultimo_ingreso: string | null,
 *   }>,
 *   incluirInactivos: boolean,
 * }} props
 */
export function UsuariosTable({ usuarios, incluirInactivos }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [busqueda, setBusqueda] = useState("");
  const [rol, setRol] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [enEdicion, setEnEdicion] = useState(null);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return usuarios.filter(
      (u) =>
        (!rol || u.rol_usuario === rol) &&
        (!q ||
          u.nombre_completo.toLowerCase().includes(q) ||
          String(u.dni_usuario ?? "").includes(q) ||
          String(u.mail_usuario ?? "")
            .toLowerCase()
            .includes(q))
    );
  }, [usuarios, busqueda, rol]);

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

  function abrirEdicion(usuario) {
    setEnEdicion(usuario);
    setModalAbierto(true);
  }

  function manejarErrorAccion(result) {
    window.alert(result.error);
    if (result.code === "USR05") router.refresh();
  }

  function toggleActivo(usuario) {
    if (
      usuario.activo &&
      !window.confirm(
        `¿Inhabilitar a ${usuario.nombre_completo}? No va a poder ingresar al sistema y se cierran sus sesiones abiertas.`
      )
    ) {
      return;
    }

    startTransition(async () => {
      const result = usuario.activo
        ? await inhabilitarUsuario(usuario.id_usuario)
        : await habilitarUsuario(usuario.id_usuario);
      if (!result.ok) {
        manejarErrorAccion(result);
        return;
      }
      router.refresh();
    });
  }

  function eliminar(usuario) {
    const confirmado = window.confirm(
      `¿Eliminar a ${usuario.nombre_completo}? Se borra su cuenta y esta acción no se puede deshacer.`
    );
    if (!confirmado) return;

    startTransition(async () => {
      const result = await eliminarUsuario(usuario.id_usuario);
      if (!result.ok) {
        manejarErrorAccion(result);
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, DNI o mail"
            className="palacio-input max-w-xs"
          />
          <select
            value={rol}
            onChange={(e) => setRol(e.target.value)}
            className="palacio-input w-auto"
            aria-label="Filtrar por rol"
          >
            <option value="">Todos los roles</option>
            {ROLES_EMPLEADO.map((r) => (
              <option key={r} value={r}>
                {ROL_LABEL[r]}
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
        </div>
        <button
          type="button"
          onClick={abrirAlta}
          className="palacio-btn-primary inline-flex px-4 py-2.5 text-sm"
        >
          Nuevo usuario
        </button>
      </div>

      {filtrados.length === 0 ? (
        <div className="palacio-card px-6 py-12 text-center">
          <p className="text-sm text-palacio-muted">
            {usuarios.length === 0
              ? "No hay empleados cargados."
              : "Ningún empleado coincide con la búsqueda."}
          </p>
        </div>
      ) : (
        <div className="palacio-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-palacio-border px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Listado</h2>
            <span className="text-xs text-palacio-muted">
              {filtrados.length} empleado
              {filtrados.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-palacio-border bg-zinc-50/80">
                  <Th>Empleado</Th>
                  <Th>DNI</Th>
                  <Th>Rol</Th>
                  <Th>Teléfono</Th>
                  <Th className="text-center">Estado</Th>
                  <Th>Último ingreso</Th>
                  <Th>Alta</Th>
                  <Th className="text-right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((u) => (
                  <tr
                    key={u.id_usuario}
                    className={[
                      "border-b border-palacio-border last:border-0",
                      u.activo ? "" : "opacity-60",
                    ].join(" ")}
                  >
                    <td className="px-5 py-4 align-middle">
                      <p className="font-medium text-zinc-900">{u.nombre_completo}</p>
                      <p className="text-xs text-palacio-muted">{u.mail_usuario}</p>
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <span className="font-mono text-xs text-zinc-700">
                        {u.dni_usuario}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {ROL_LABEL[u.rol_usuario] ?? u.rol_usuario}
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {u.telefono_usuario}
                    </td>
                    <td className="px-5 py-4 text-center align-middle">
                      <span
                        className={
                          u.activo
                            ? "palacio-badge-activo"
                            : "palacio-badge-inactivo"
                        }
                      >
                        {u.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {u.ultimo_ingreso ? formatFecha(u.ultimo_ingreso) : "Nunca"}
                    </td>
                    <td className="px-5 py-4 align-middle text-palacio-muted">
                      {formatFecha(u.creado)}
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => abrirEdicion(u)}
                          className="palacio-action-btn palacio-action-primary"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => toggleActivo(u)}
                          className="palacio-action-btn"
                        >
                          {u.activo ? "Inhabilitar" : "Habilitar"}
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => eliminar(u)}
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
        <UsuarioFormModal
          key={enEdicion?.id_usuario ?? "nuevo"}
          onClose={() => setModalAbierto(false)}
          usuario={enEdicion}
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
