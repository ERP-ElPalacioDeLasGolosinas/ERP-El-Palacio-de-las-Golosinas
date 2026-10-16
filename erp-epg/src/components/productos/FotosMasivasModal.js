"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TIPOS_FOTO, subirFotoProducto } from "@/lib/productos/foto-cliente";

const clave = (t) => String(t ?? "").trim().toLowerCase();
const sinExtension = (nombre) => nombre.replace(/\.[^.]+$/, "");

/**
 * Carga masiva de fotos: cada archivo se asigna al artículo cuyo código coincide con su nombre
 * (sin extensión, sin distinguir mayúsculas). Ej.: `ALF-001.jpg` -> artículo con código ALF-001.
 * @param {{ productos: Array<Record<string, any>>, onClose: () => void }} props
 */
export function FotosMasivasModal({ productos, onClose }) {
  const router = useRouter();
  const inputRef = useRef(null);
  const [filas, setFilas] = useState([]);
  const [subiendo, setSubiendo] = useState(false);
  const [terminado, setTerminado] = useState(false);

  const porCodigo = useMemo(() => {
    const m = new Map();
    for (const p of productos) m.set(clave(p.codigo_producto), p);
    return m;
  }, [productos]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !subiendo && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, subiendo]);

  function elegir(e) {
    const archivos = Array.from(e.target.files ?? []);
    e.target.value = "";
    const vistos = new Set();
    setTerminado(false);
    setFilas(
      archivos.map((file, i) => {
        const codigo = sinExtension(file.name);
        const producto = porCodigo.get(clave(codigo)) ?? null;
        let estado = "listo";
        let msg = "";
        if (!TIPOS_FOTO.includes(file.type)) {
          estado = "omitido";
          msg = "No es JPG, PNG ni WebP";
        } else if (!producto) {
          estado = "omitido";
          msg = "Ningún artículo tiene ese código";
        } else if (vistos.has(producto.id_producto)) {
          estado = "omitido";
          msg = "Hay otro archivo para el mismo artículo";
        } else {
          vistos.add(producto.id_producto);
        }
        return { id: i, file, codigo, producto, estado, msg };
      })
    );
  }

  const actualizar = (id, cambios) =>
    setFilas((fs) => fs.map((f) => (f.id === id ? { ...f, ...cambios } : f)));

  async function subirTodas() {
    setSubiendo(true);
    for (const fila of filas) {
      if (fila.estado !== "listo") continue;
      actualizar(fila.id, { estado: "subiendo", msg: "" });
      try {
        await subirFotoProducto(fila.producto.id_producto, fila.file);
        actualizar(fila.id, { estado: "ok", msg: "" });
      } catch (err) {
        actualizar(fila.id, { estado: "error", msg: err.message || "No se pudo subir" });
      }
    }
    setSubiendo(false);
    setTerminado(true);
    router.refresh();
  }

  const listas = filas.filter((f) => f.estado === "listo").length;
  const ok = filas.filter((f) => f.estado === "ok").length;
  const conError = filas.filter((f) => f.estado === "error").length;
  const omitidas = filas.filter((f) => f.estado === "omitido").length;

  const etiqueta = {
    listo: ["Lista", "text-zinc-700"],
    subiendo: ["Subiendo…", "text-palacio-red"],
    ok: ["Subida", "text-green-700"],
    error: ["Error", "text-red-700"],
    omitido: ["Omitida", "text-amber-700"],
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Cargar fotos en lote"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !subiendo) onClose();
      }}
    >
      <div className="palacio-card my-8 w-full max-w-2xl p-6">
        <h2 className="text-lg font-bold text-zinc-900">Cargar fotos en lote</h2>
        <p className="mt-1 text-sm text-palacio-muted">
          Nombrá cada archivo con el <strong>código del artículo</strong> (por ejemplo{" "}
          <code className="rounded bg-zinc-100 px-1">ALF-001.jpg</code>) y elegí todos juntos. Se
          achican solas y reemplazan la foto anterior.
        </p>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={elegir}
          disabled={subiendo}
          className="hidden"
        />
        <button
          type="button"
          disabled={subiendo}
          onClick={() => inputRef.current?.click()}
          className="palacio-btn-secondary mt-4 px-4 py-2 text-sm"
        >
          {filas.length > 0 ? "Elegir otras imágenes" : "Elegir imágenes"}
        </button>

        {filas.length > 0 ? (
          <>
            <div className="mt-4 max-h-80 overflow-y-auto rounded-lg border border-palacio-border">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-zinc-50">
                  <tr className="border-b border-palacio-border text-[11px] uppercase tracking-wider text-palacio-muted">
                    <th className="px-3 py-2">Archivo</th>
                    <th className="px-3 py-2">Artículo</th>
                    <th className="px-3 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => (
                    <tr key={f.id} className="border-b border-palacio-border last:border-0">
                      <td className="px-3 py-2 font-mono text-xs">{f.file.name}</td>
                      <td className="px-3 py-2">
                        {f.producto ? (f.producto.nombre_completo ?? f.producto.nombre_producto) : "—"}
                      </td>
                      <td className={`px-3 py-2 text-xs font-medium ${etiqueta[f.estado][1]}`}>
                        {etiqueta[f.estado][0]}
                        {f.msg ? <span className="block font-normal">{f.msg}</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-sm text-palacio-muted" aria-live="polite">
              {terminado
                ? `Listo: ${ok} subida${ok === 1 ? "" : "s"}, ${conError} con error, ${omitidas} omitida${omitidas === 1 ? "" : "s"}.`
                : `${listas} para subir, ${omitidas} omitida${omitidas === 1 ? "" : "s"}.`}
            </p>
          </>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" disabled={subiendo} onClick={onClose} className="palacio-btn-secondary px-4 py-2 text-sm">
            {terminado ? "Cerrar" : "Cancelar"}
          </button>
          {listas > 0 ? (
            <button type="button" disabled={subiendo} onClick={subirTodas} className="palacio-btn-primary px-4 py-2 text-sm">
              {subiendo ? "Subiendo…" : `Subir ${listas} foto${listas === 1 ? "" : "s"}`}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
