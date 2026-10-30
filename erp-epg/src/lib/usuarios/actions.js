"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ROLES_EMPLEADO } from "@/lib/usuarios/constantes";

const PATH = "/usuarios/gestion";
const MAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @param {{ message?: string, code?: string } | null | undefined} error
 * @param {string} fallback
 */
function errorResult(error, fallback) {
  return {
    ok: false,
    code: error?.code ?? null,
    error: error?.message || fallback,
  };
}

/**
 * @param {FormData | Record<string, unknown>} input
 * @param {string} key
 */
function texto(input, key) {
  const value =
    typeof input.get === "function" ? input.get(key) : input[key];
  if (value == null) return "";
  return String(value).trim();
}

/**
 * Lista los empleados (sin gerentes) vía `fn_usuario_listar`. Solo Gerente (USR01).
 *
 * @param {boolean} [incluirInactivos=true]
 * @returns {Promise<{ data: Array<{
 *   id_usuario: string,
 *   nombre_usuario: string,
 *   apellido_usuario: string,
 *   nombre_completo: string,
 *   fecha_nacimiento_usuario: string,
 *   dni_usuario: number,
 *   telefono_usuario: string,
 *   mail_usuario: string,
 *   rol_usuario: string,
 *   activo: boolean,
 *   creado: string,
 *   editado: string,
 *   ultimo_ingreso: string | null,
 * }> | null, error: string | null }>}
 */
export async function listarUsuarios(incluirInactivos = true) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_usuario_listar", {
    p_incluir_inactivos: Boolean(incluirInactivos),
  });

  if (error) {
    return {
      data: null,
      error:
        error.code === "USR01"
          ? error.message
          : "No se pudieron cargar los usuarios.",
    };
  }

  return { data: data ?? [], error: null };
}

/**
 * Datos comunes del alta y la edición. Devuelve el error con el mismo código que
 * usaría `fn_usuario_modificar`, así el alta (edge function) mapea igual.
 *
 * @param {FormData} formData
 */
function leerDatos(formData) {
  const dni = Number(texto(formData, "dni_usuario"));
  const datos = {
    nombre_usuario: texto(formData, "nombre_usuario"),
    apellido_usuario: texto(formData, "apellido_usuario"),
    fecha_nacimiento_usuario: texto(formData, "fecha_nacimiento_usuario"),
    dni_usuario: Number.isInteger(dni) ? dni : null,
    telefono_usuario: texto(formData, "telefono_usuario"),
    rol_usuario: texto(formData, "rol_usuario"),
  };

  let error = null;
  if (!datos.nombre_usuario || !datos.apellido_usuario) {
    error = { code: "USR02", message: "El nombre y el apellido son obligatorios." };
  } else if (!datos.dni_usuario || datos.dni_usuario < 1000000 || datos.dni_usuario > 99999999) {
    error = { code: "USR03", message: "El DNI debe tener entre 7 y 8 dígitos." };
  } else if (!ROLES_EMPLEADO.includes(datos.rol_usuario)) {
    error = { code: "USR07", message: "Elegí un rol: depósito, compras o ventas." };
  } else if (!datos.fecha_nacimiento_usuario) {
    error = { code: "USR08", message: "La fecha de nacimiento es obligatoria." };
  } else if (!/^\d{6,15}$/.test(datos.telefono_usuario)) {
    error = { code: "USR09", message: "El teléfono debe tener entre 6 y 15 dígitos." };
  }

  return { datos, error };
}

/**
 * Alta de empleado: la edge function `crear-usuario` crea la cuenta de Auth (con service role)
 * y la fila de `usuario`, y verifica que quien llama sea Gerente.
 *
 * @param {FormData} formData
 * @returns {Promise<{ ok: boolean, error: string | null, code?: string | null }>}
 */
export async function crearUsuario(formData) {
  const { datos, error: errorDatos } = leerDatos(formData);
  if (errorDatos) return errorResult(errorDatos, "No se pudo crear el usuario.");

  const email = texto(formData, "mail_usuario").toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!MAIL_RE.test(email)) {
    return { ok: false, code: null, error: "Ingresá un correo electrónico válido." };
  }
  if (password.length < 8) {
    return { ok: false, code: null, error: "La contraseña debe tener al menos 8 caracteres." };
  }

  const supabase = await createClient();
  const { error } = await supabase.functions.invoke("crear-usuario", {
    body: { ...datos, email, password },
  });

  if (error) {
    // La edge function responde { error } con el detalle de Auth o del insert.
    let detalle = "";
    try {
      detalle = String((await error.context?.json())?.error ?? "");
    } catch {
      detalle = "";
    }

    if (/already (been )?registered|already exists/i.test(detalle)) {
      return { ok: false, code: "MAIL", error: "Ya existe una cuenta con ese correo." };
    }
    if (/dni_usuario/i.test(detalle)) {
      return { ok: false, code: "USR04", error: "Ya existe otro usuario con ese DNI." };
    }
    if (/Gerente/i.test(detalle)) {
      return { ok: false, code: "USR01", error: "Solo el gerente puede gestionar usuarios." };
    }
    return { ok: false, code: null, error: "No se pudo crear el usuario." };
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

/**
 * @param {string} id_usuario
 * @param {FormData} formData
 * @returns {Promise<{ ok: boolean, error: string | null, code?: string | null }>}
 */
export async function actualizarUsuario(id_usuario, formData) {
  if (!id_usuario) {
    return { ok: false, code: null, error: "Falta el identificador del usuario." };
  }

  const { datos, error: errorDatos } = leerDatos(formData);
  if (errorDatos) return errorResult(errorDatos, "No se pudo guardar el usuario.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_usuario_modificar", {
    p_id_usuario: id_usuario,
    p_nombre_usuario: datos.nombre_usuario,
    p_apellido_usuario: datos.apellido_usuario,
    p_fecha_nacimiento_usuario: datos.fecha_nacimiento_usuario,
    p_dni_usuario: datos.dni_usuario,
    p_telefono_usuario: datos.telefono_usuario,
    p_rol_usuario: datos.rol_usuario,
  });

  if (error) {
    return errorResult(error, "No se pudo guardar el usuario.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

/**
 * @param {string} id_usuario
 */
export async function habilitarUsuario(id_usuario) {
  if (!id_usuario) {
    return { ok: false, code: null, error: "Falta el identificador del usuario." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_usuario_habilitar", {
    p_id_usuario: id_usuario,
  });

  if (error) {
    return errorResult(error, "No se pudo habilitar el usuario.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

/**
 * Inhabilita al empleado: no puede volver a ingresar y se cierran sus sesiones abiertas.
 *
 * @param {string} id_usuario
 */
export async function inhabilitarUsuario(id_usuario) {
  if (!id_usuario) {
    return { ok: false, code: null, error: "Falta el identificador del usuario." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_usuario_inhabilitar", {
    p_id_usuario: id_usuario,
  });

  if (error) {
    // USR10 ya trae el mensaje de la caja en curso.
    return errorResult(error, "No se pudo inhabilitar el usuario.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}

/**
 * @param {string} id_usuario
 */
export async function eliminarUsuario(id_usuario) {
  if (!id_usuario) {
    return { ok: false, code: null, error: "Falta el identificador del usuario." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_usuario_eliminar", {
    p_id_usuario: id_usuario,
  });

  if (error) {
    // USR11 ya trae el mensaje sugiriendo inhabilitar.
    return errorResult(error, "No se pudo eliminar el usuario.");
  }

  revalidatePath(PATH);
  return { ok: true, error: null, code: null };
}
