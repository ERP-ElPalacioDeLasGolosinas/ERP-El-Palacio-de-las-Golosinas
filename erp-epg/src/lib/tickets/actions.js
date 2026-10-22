"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mensajeErrorTicket } from "@/lib/tienda/errores";
import { ESTADOS_TICKET } from "@/lib/tickets/estado";
import { notificarRespuestaTicket } from "@/lib/email/ticket";

const PATH = "/ventas/tickets";

/**
 * Lista los tickets de soporte vía `fn_ticket_listar` (solo personal del ERP).
 *
 * @param {{ estado?: string | null }} [filtros]
 * @returns {Promise<{ data: Array<Record<string, any>> | null, error: string | null }>}
 */
export async function listarTickets(filtros = {}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_ticket_listar", {
    p_estado: ESTADOS_TICKET.includes(filtros.estado) ? filtros.estado : null,
  });

  if (error) {
    return { data: null, error: "No se pudieron cargar los tickets." };
  }

  return { data: data ?? [], error: null };
}

/**
 * Obtiene un ticket con su conversación vía `fn_ticket_obtener`.
 *
 * @param {string} idTicket
 * @returns {Promise<{ data: Record<string, any> | null, error: string | null }>}
 */
export async function obtenerTicket(idTicket) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_ticket_obtener", { p_id_ticket: idTicket });
  if (error) {
    return { data: null, error: mensajeErrorTicket(error) };
  }
  return { data: (Array.isArray(data) ? data[0] : data) ?? null, error: null };
}

/**
 * Responde un ticket como personal (`fn_ticket_responder_personal`). Firma de `useActionState`.
 */
export async function responderTicketPersonal(_prev, formData) {
  const idTicket = String(formData.get("id_ticket") ?? "");
  const mensaje = String(formData.get("mensaje") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_ticket_responder_personal", {
    p_id_ticket: idTicket,
    p_mensaje: mensaje,
  });
  if (error) return { error: mensajeErrorTicket(error), ok: false };

  // Aviso por mail al cliente; un fallo no afecta la respuesta ya guardada.
  const { data: ticket } = await obtenerTicket(idTicket);
  if (ticket) {
    await notificarRespuestaTicket({
      email: ticket.mail_cliente,
      asunto: ticket.asunto,
      mensaje: mensaje.trim(),
    });
  }
  revalidatePath(`${PATH}/${idTicket}`);
  revalidatePath(PATH);
  return { error: null, ok: true };
}

/**
 * Cambia el estado de un ticket (`fn_ticket_cambiar_estado`).
 *
 * @param {string} idTicket
 * @param {string} estado
 * @returns {Promise<{ ok: boolean, error: string | null }>}
 */
export async function cambiarEstadoTicket(idTicket, estado) {
  if (!idTicket || !ESTADOS_TICKET.includes(estado)) {
    return { ok: false, error: "Datos del cambio de estado inválidos." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_ticket_cambiar_estado", {
    p_id_ticket: idTicket,
    p_estado: estado,
  });
  if (error) return { ok: false, error: mensajeErrorTicket(error) };
  revalidatePath(`${PATH}/${idTicket}`);
  revalidatePath(PATH);
  return { ok: true, error: null };
}
