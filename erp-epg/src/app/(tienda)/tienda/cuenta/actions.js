"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { mensajeErrorRegistro, mensajeErrorTicket } from "@/lib/tienda/errores";

export async function actualizarDatosCuenta(_prev, formData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_cliente_web_actualizar_datos", {
    p_nombre_cliente: String(formData.get("nombre") ?? ""),
    p_telefono_cliente: String(formData.get("telefono") ?? ""),
    p_direccion_cliente: String(formData.get("direccion") ?? "") || null,
    p_documento_cliente: String(formData.get("documento") ?? ""),
  });
  if (error) return { error: mensajeErrorRegistro(error), ok: false };
  revalidatePath("/tienda/cuenta", "layout");
  return { error: null, ok: true };
}

export async function marcarNotificacionesVistas() {
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_cliente_web_notificaciones_marcar_vistas");
  if (!error) revalidatePath("/tienda", "layout");
}

export async function crearTicket(_prev, formData) {
  const supabase = await createClient();
  const { data: idTicket, error } = await supabase.rpc("fn_ticket_crear", {
    p_asunto: String(formData.get("asunto") ?? ""),
    p_mensaje: String(formData.get("mensaje") ?? ""),
    p_id_pedido: String(formData.get("id_pedido") ?? "") || null,
  });
  if (error) return { error: mensajeErrorTicket(error) };
  revalidatePath("/tienda/cuenta/soporte");
  redirect(idTicket ? `/tienda/cuenta/soporte/${idTicket}` : "/tienda/cuenta/soporte");
}

export async function responderTicket(_prev, formData) {
  const idTicket = String(formData.get("id_ticket") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_ticket_responder_cliente", {
    p_id_ticket: idTicket,
    p_mensaje: String(formData.get("mensaje") ?? ""),
  });
  if (error) return { error: mensajeErrorTicket(error), ok: false };
  revalidatePath(`/tienda/cuenta/soporte/${idTicket}`);
  revalidatePath("/tienda/cuenta/soporte");
  return { error: null, ok: true };
}
