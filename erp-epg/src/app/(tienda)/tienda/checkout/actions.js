"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { notificarEstadoPedido } from "@/lib/email/pedido";
import { createClient } from "@/lib/supabase/server";
import { guardarCarrito, leerCarrito } from "@/lib/tienda/carrito";
import { mensajeErrorPedido, mensajeErrorRegistro } from "@/lib/tienda/errores";

export async function completarDatosCliente(_prev, formData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_cliente_web_completar_datos", {
    p_documento_cliente: String(formData.get("documento") ?? ""),
    p_telefono_cliente: String(formData.get("telefono") ?? ""),
    p_direccion_cliente: String(formData.get("direccion") ?? "") || null,
  });
  if (error) return { error: mensajeErrorRegistro(error) };
  revalidatePath("/checkout");
  return { error: null };
}

export async function confirmarPedido() {
  const items = await leerCarrito();
  if (items.length === 0) return { error: mensajeErrorPedido({ code: "PWB03" }) };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_pedido_web_registrar", {
    p_items: items.map((l) => ({ id_producto: l.id_producto, cantidad: l.cantidad })),
    p_medio: "Transferencia",
  });
  if (error) return { error: mensajeErrorPedido(error) };

  const pedido = Array.isArray(data) ? data[0] : data;
  await guardarCarrito([]);

  // Aviso por mail (E-06); un fallo no afecta al pedido ya registrado.
  const { data: auth } = await supabase.auth.getUser();
  await notificarEstadoPedido({
    email: auth?.user?.email,
    numero: pedido.numero,
    estado: "Pendiente de pago",
    importeTotal: pedido.importe_total,
  });

  redirect(`/checkout/confirmado?pedido=${encodeURIComponent(pedido.id_pedido)}`);
}
